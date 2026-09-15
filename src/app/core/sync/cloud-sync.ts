import { Injectable, signal } from '@angular/core';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import type { Reading, ReadingState } from '../reading/reading';
import { surahAtPage } from '../quran/quran-meta';

type SyncStatus = 'connecting' | 'ready' | 'offline';

export interface CloudAccount {
  uid: string;
  anonymous: boolean;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
}

/** Everything the store needs to merge after signing into an account that already has data. */
export interface CloudSnapshot {
  readings: Reading[];
  state: Partial<ReadingState> | null;
}

interface Session {
  db: Firestore;
  fs: typeof import('firebase/firestore');
  auth: Auth;
  authMod: typeof import('firebase/auth');
}

/** Firestore allows 500 writes per batch. */
const BATCH_LIMIT = 450;
/** Page turns update the reading position; coalesce them so a reading session costs a handful of writes. */
const STATE_DEBOUNCE_MS = 15_000;
const PULLED_KEY = 'khatma.cloud.pulledUid';

/**
 * Mirrors device data to Firestore (docs/DECISIONS.md P1, T3, T27). Starts with an anonymous account;
 * signing in with Google links that account so its uid and data stay the same. Firebase is loaded lazily
 * so it never slows the first paint, and the app works fully without it. Spark plan: writes are batched
 * and debounced, and the full account is read only once per account per device.
 */
@Injectable({ providedIn: 'root' })
export class CloudSync {
  readonly status = signal<SyncStatus>('connecting');
  readonly account = signal<CloudAccount | null>(null);
  readonly busy = signal(false);

  private readonly session = this.connect();
  private accountListener: ((account: CloudAccount, isNewHere: boolean) => void) | null = null;
  private stateTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: ReadingState | null = null;

  /** Called once an account is known, and again whenever it changes (sign-in, sign-out). */
  onAccount(listener: (account: CloudAccount, isNewHere: boolean) => void) {
    this.accountListener = listener;
    const current = this.account();
    if (current) listener(current, this.isNewHere(current));
  }

  pushReadings(readings: Reading[], onSynced: (ids: string[]) => void) {
    this.session
      .then(async (s) => {
        const uid = s?.auth.currentUser?.uid;
        if (!s || !uid || !readings.length) return;
        for (let i = 0; i < readings.length; i += BATCH_LIMIT) {
          const chunk = readings.slice(i, i + BATCH_LIMIT);
          const batch = s.fs.writeBatch(s.db);
          for (const { synced, ...r } of chunk) batch.set(s.fs.doc(s.db, 'users', uid, 'readings', r.id), r);
          await batch.commit();
          onSynced(chunk.map((r) => r.id));
        }
      })
      .catch((err) => console.warn('[sync] readings', err));
  }

  /** Reading position and preferences: the private copy plus the public status family members may see (P11). */
  pushState(state: ReadingState) {
    this.pendingState = state;
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => this.flushState(), STATE_DEBOUNCE_MS);
  }

  /** Send any debounced state now (page hide, sign-out). */
  flushState() {
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
    const state = this.pendingState;
    this.pendingState = null;
    if (!state) return;
    this.session
      .then(async (s) => {
        const uid = s?.auth.currentUser?.uid;
        if (!s || !uid) return;
        const batch = s.fs.writeBatch(s.db);
        batch.set(s.fs.doc(s.db, 'users', uid, 'profile', 'state'), state);
        batch.set(s.fs.doc(s.db, 'users', uid, 'status', 'public'), {
          lastPage: state.lastPage,
          surah: surahAtPage(state.lastPage),
          khatma: state.currentKhatma,
          lastReadAt: state.lastReadAt,
        });
        await batch.commit();
      })
      .catch((err) => console.warn('[sync] state', err));
  }

  /** Everything stored for the signed-in account. */
  async pull(): Promise<CloudSnapshot | null> {
    const s = await this.session;
    const uid = s?.auth.currentUser?.uid;
    if (!s || !uid) return null;
    const [readings, state] = await Promise.all([
      s.fs.getDocs(s.fs.collection(s.db, 'users', uid, 'readings')),
      s.fs.getDoc(s.fs.doc(s.db, 'users', uid, 'profile', 'state')),
    ]);
    this.markPulled(uid);
    return {
      readings: readings.docs.map((d) => ({ ...(d.data() as Omit<Reading, 'synced'>), synced: 1 as const })),
      state: (state.data() as Partial<ReadingState> | undefined) ?? null,
    };
  }

  markPulled(uid: string) {
    try {
      localStorage.setItem(PULLED_KEY, uid);
    } catch {
      // Pulled again next time; harmless.
    }
  }

  /**
   * Google sign-in. From an anonymous account this links Google to it, keeping the same uid and data.
   * If that Google account already has data (another device), it signs into it instead and the store merges.
   * Returns an Arabic error message, or null on success or when the person closed the window.
   */
  async signInWithGoogle(): Promise<string | null> {
    const s = await this.session;
    if (!s) return 'تعذّر الاتصال بالخدمة. تأكد من الإنترنت وحاول مرة أخرى.';
    const { authMod, auth } = s;
    const provider = new authMod.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    this.busy.set(true);
    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        try {
          await authMod.linkWithPopup(current, provider);
          // Same uid and its data are already in the cloud: nothing to download, just show the name and photo.
          this.markPulled(current.uid);
          await current.reload();
          this.setAccount(auth.currentUser);
          return null;
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') throw err;
          const credential = authMod.GoogleAuthProvider.credentialFromError(err as never);
          if (!credential) throw err;
          await authMod.signInWithCredential(auth, credential);
          return null;
        }
      }
      await authMod.signInWithPopup(auth, provider);
      return null;
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
      if (code === 'auth/popup-blocked') return 'المتصفح منع نافذة تسجيل الدخول. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول مجدداً.';
      if (code === 'auth/network-request-failed') return 'لا يوجد اتصال بالإنترنت.';
      console.warn('[sync] google sign-in', err);
      return 'تعذّر تسجيل الدخول. حاول مرة أخرى.';
    } finally {
      this.busy.set(false);
    }
  }

  /** Signs out of Google; the device keeps its data and continues with a fresh anonymous account. */
  async signOut() {
    const s = await this.session;
    if (!s) return;
    this.flushState();
    this.busy.set(true);
    try {
      await s.authMod.signOut(s.auth);
      await s.authMod.signInAnonymously(s.auth);
    } finally {
      this.busy.set(false);
    }
  }

  private async connect(): Promise<Session | null> {
    try {
      const [{ initializeApp }, authMod, fs] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = initializeApp(environment.firebase);
      const db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
      const auth = authMod.getAuth(app);
      await auth.authStateReady();
      authMod.onAuthStateChanged(auth, (user) => this.setAccount(user));
      if (!auth.currentUser) await authMod.signInAnonymously(auth);
      this.status.set('ready');
      if (typeof window !== 'undefined') window.addEventListener('pagehide', () => this.flushState());
      return { db, fs, auth, authMod };
    } catch (err) {
      console.warn('[sync] unavailable, staying device-only', err);
      this.status.set('offline');
      return null;
    }
  }

  private setAccount(user: User | null) {
    if (!user) return this.account.set(null);
    const google = user.providerData.find((p) => p.providerId === 'google.com');
    const next: CloudAccount = {
      uid: user.uid,
      anonymous: user.isAnonymous,
      name: google?.displayName ?? user.displayName,
      email: google?.email ?? user.email,
      photoUrl: google?.photoURL ?? user.photoURL,
    };
    const prev = this.account();
    this.account.set(next);
    if (prev?.uid !== next.uid || prev?.anonymous !== next.anonymous) this.accountListener?.(next, this.isNewHere(next));
  }

  /** A permanent account this device has not downloaded yet. */
  private isNewHere(account: CloudAccount) {
    if (account.anonymous) return false;
    try {
      return localStorage.getItem(PULLED_KEY) !== account.uid;
    } catch {
      return true;
    }
  }
}
