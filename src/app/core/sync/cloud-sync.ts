import { inject, Injectable, ProviderToken, signal } from '@angular/core';
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

/**
 * A small piece of device data kept as one document (`users/{uid}/profile/{name}`), e.g. ayah groups.
 * On a new account the newer copy wins by `updatedAt`.
 */
export interface SyncedDoc<T extends object> {
  name: string;
  read(): { data: T; updatedAt: number };
  apply(data: T, updatedAt: number): void;
  merge?: (cloudData: T, cloudUpdatedAt: number) => void;
  /** Forget the copy on this device, because another account is taking the device over. */
  reset?: () => void;
}

/** The reading data of this device: sent up before a sign-out, cleared when another account takes over. */
export interface DeviceHooks {
  flush(): Promise<void>;
  wipe(): Promise<void>;
}

/**
 * True when the account signing in is not the one whose data sits on this device: a shared phone.
 * An anonymous session is nobody's yet, so it may still be claimed by the first account that signs in.
 */
export function isDeviceTakeover(ownerUid: string | null, account: CloudAccount) {
  return !account.anonymous && !!ownerUid && ownerUid !== account.uid;
}

/** For stores that are also constructed directly in unit tests, outside the Angular injector. */
export function injectOptional<T>(token: ProviderToken<T>): T | null {
  try {
    return inject(token);
  } catch {
    return null;
  }
}

const DOC_DEBOUNCE_MS = 100;

/** Firestore allows 500 writes per batch. */
const BATCH_LIMIT = 450;
/**
 * Page turns update the reading position; coalesce them so a reading session costs a handful of writes.
 * The Spark plan gives the whole project 20k writes a day, shared by every reader, so this window is wide:
 * the position is also flushed on page hide and sign-out, which is when it actually has to be right.
 */
const STATE_DEBOUNCE_MS = 60_000;
/**
 * `status/public` exists for family sharing (P11), which is not built yet — nothing reads it. Writing it
 * doubles the cost of every position update, so it stays off until the family card needs it.
 */
const FAMILY_SHARING = false;
const PULLED_KEY = 'khatma.cloud.pulledUid';
/** The permanent account whose data sits on this device; two people on one phone must never be merged. */
const OWNER_KEY = 'khatma.cloud.ownerUid';
/** Set by an explicit sign-out: the device stays local-only instead of opening a throwaway anonymous account. */
const SIGNED_OUT_KEY = 'khatma.cloud.signedOut';

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
  /**
   * A permanent account signed in while this device still holds a different account's data (a shared phone).
   * Every read, write and merge is held until `confirmSwitch()` or `cancelSwitch()` settles it, so one
   * person's khatmas can never be uploaded into someone else's account.
   */
  readonly pendingSwitch = signal<CloudAccount | null>(null);

  private readonly session = this.connect();
  private accountListener: ((account: CloudAccount, isNewHere: boolean) => void) | null = null;
  private deviceHooks: DeviceHooks | null = null;
  private stateTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: ReadingState | null = null;
  private readonly docs = new Map<string, SyncedDoc<object>>();
  private readonly docTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** True between an unexpected account appearing and the person deciding what to do about it. */
  private held = false;

  /** Keep a device document in the cloud; merged once per account per device, pushed after every change. */
  registerDoc<T extends object>(doc: SyncedDoc<T>) {
    this.docs.set(doc.name, doc as unknown as SyncedDoc<object>);
    const account = this.account();
    if (account) void this.mergeDoc(doc.name, account);
  }

  /** The reading data of this device, so sign-out can flush it and an account switch can clear it. */
  registerDevice(hooks: DeviceHooks) {
    this.deviceHooks = hooks;
  }

  /** The document changed on this device: upload it shortly. */
  touchDoc(name: string) {
    const existing = this.docTimers.get(name);
    if (existing) clearTimeout(existing);
    this.docTimers.set(name, setTimeout(() => void this.flushDoc(name), DOC_DEBOUNCE_MS));
  }

  private async flushDoc(name: string) {
    const timer = this.docTimers.get(name);
    if (timer) clearTimeout(timer);
    this.docTimers.delete(name);
    const doc = this.docs.get(name);
    if (!doc || this.held) return;
    const { data, updatedAt } = doc.read();
    try {
      const s = await this.session;
      const uid = s?.auth.currentUser?.uid;
      if (!s || !uid || this.held) return;
      await s.fs.setDoc(s.fs.doc(s.db, 'users', uid, 'profile', name), {
        data: JSON.parse(JSON.stringify(data)),
        updatedAt,
      });
    } catch (err) {
      console.warn(`[sync] ${name}`, err);
    }
  }

  private async mergeDoc(name: string, account: CloudAccount) {
    if (account.anonymous || this.held) return;
    const s = await this.session;
    const doc = this.docs.get(name);
    if (!s || !doc || this.held || s.auth.currentUser?.uid !== account.uid) return;
    try {
      const snap = await s.fs.getDoc(s.fs.doc(s.db, 'users', account.uid, 'profile', name));
      const cloud = snap.data() as { data: object; updatedAt: number } | undefined;
      const localAt = doc.read().updatedAt;

      if (cloud) {
        if (doc.merge) {
          doc.merge(cloud.data, cloud.updatedAt);
        } else {
          if (cloud.updatedAt > localAt) doc.apply(cloud.data, cloud.updatedAt);
          else if (localAt > cloud.updatedAt) void this.flushDoc(name);
        }
      } else {
        void this.flushDoc(name);
      }
    } catch (err) {
      console.warn(`[sync] merge ${name}`, err);
    }
  }

  /** Called once an account is known, and again whenever it changes (sign-in, sign-out). */
  onAccount(listener: (account: CloudAccount, isNewHere: boolean) => void) {
    this.accountListener = listener;
    const current = this.account();
    if (current) listener(current, this.isNewHere(current));
  }

  /** Uploads readings and reports back which ones landed, and in which account they landed. */
  async pushReadings(readings: Reading[], onSynced: (ids: string[], uid: string) => void) {
    if (this.held) return;
    try {
      const s = await this.session;
      const uid = s?.auth.currentUser?.uid;
      if (!s || !uid || !readings.length || this.held) return;
      for (let i = 0; i < readings.length; i += BATCH_LIMIT) {
        const chunk = readings.slice(i, i + BATCH_LIMIT);
        const batch = s.fs.writeBatch(s.db);
        for (const { synced, syncedTo, ...r } of chunk) batch.set(s.fs.doc(s.db, 'users', uid, 'readings', r.id), r);
        await batch.commit();
        if (this.held) return;
        onSynced(
          chunk.map((r) => r.id),
          uid,
        );
      }
    } catch (err) {
      console.warn('[sync] readings', err);
    }
  }

  /** Reading position and preferences: the private copy plus the public status family members may see (P11). */
  pushState(state: ReadingState) {
    this.pendingState = state;
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => void this.flushState(), STATE_DEBOUNCE_MS);
  }

  /** Send any debounced state now (page hide, sign-out). */
  async flushState() {
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.stateTimer = null;
    const state = this.pendingState;
    this.pendingState = null;
    if (!state || this.held) return;
    try {
      const s = await this.session;
      const uid = s?.auth.currentUser?.uid;
      if (!s || !uid || this.held) return;
      if (!FAMILY_SHARING) {
        await s.fs.setDoc(s.fs.doc(s.db, 'users', uid, 'profile', 'state'), state);
        return;
      }
      const batch = s.fs.writeBatch(s.db);
      batch.set(s.fs.doc(s.db, 'users', uid, 'profile', 'state'), state);
      batch.set(s.fs.doc(s.db, 'users', uid, 'status', 'public'), {
        lastPage: state.lastPage,
        surah: surahAtPage(state.lastPage),
        khatma: state.currentKhatma,
        lastReadAt: state.lastReadAt,
      });
      await batch.commit();
    } catch (err) {
      console.warn('[sync] state', err);
    }
  }

  /** Everything stored for the signed-in account; the readings come back tagged with its uid. */
  async pull(includeReadings = true): Promise<CloudSnapshot | null> {
    if (this.held) return null;
    const s = await this.session;
    const uid = s?.auth.currentUser?.uid;
    if (!s || !uid) return null;

    const [readings, state] = await Promise.all([
      includeReadings ? s.fs.getDocs(s.fs.collection(s.db, 'users', uid, 'readings')) : Promise.resolve({ docs: [] }),
      s.fs.getDoc(s.fs.doc(s.db, 'users', uid, 'profile', 'state')),
    ]);
    // Only a full download means this device now holds the account; a state-only pull does not.
    if (includeReadings) this.markPulled(uid);
    return {
      readings: includeReadings
        ? readings.docs.map((d) => ({
            ...(d.data() as Omit<Reading, 'synced' | 'syncedTo'>),
            synced: 1 as const,
            syncedTo: uid,
          }))
        : [],
      state: (state.data() as Partial<ReadingState> | undefined) ?? null,
    };
  }

  markPulled(uid: string) {
    this.write(PULLED_KEY, uid);
  }

  /**
   * Google sign-in. From an anonymous account this links Google to it, keeping the same uid and data.
   * If that Google account already has data (another device), it signs into it instead and the store merges.
   * Returns an Arabic error message, or null on success or when the person closed the window.
   */
  async signInWithGoogle(): Promise<string | null> {
    if (this.pendingSwitch()) return null;
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
      // No popup here — an in-app browser (WhatsApp, Facebook), or a browser that blocks them: leave the page instead.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          const current = auth.currentUser;
          if (current?.isAnonymous) await authMod.linkWithRedirect(current, provider);
          else await authMod.signInWithRedirect(auth, provider);
          return null;
        } catch (redirectErr) {
          console.warn('[sync] redirect sign-in', redirectErr);
          return 'تعذّر تسجيل الدخول داخل هذا المتصفح. افتح الموقع في متصفح الهاتف وحاول مرة أخرى.';
        }
      }
      if (code === 'auth/network-request-failed') return 'لا يوجد اتصال بالإنترنت.';
      if (code === 'auth/unauthorized-domain') return 'هذا الموقع غير مصرّح له بتسجيل الدخول.';
      console.warn('[sync] google sign-in', err);
      return 'تعذّر تسجيل الدخول. حاول مرة أخرى.';
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * The person accepts that the device changes hands: erase what the previous account left here,
   * then adopt the new account and download it.
   */
  async confirmSwitch() {
    const next = this.pendingSwitch();
    if (!next) return;
    this.busy.set(true);
    try {
      await this.deviceHooks?.wipe();
      for (const doc of this.docs.values()) doc.reset?.();
      this.forget(PULLED_KEY);
      this.write(OWNER_KEY, next.uid);
      this.forget(SIGNED_OUT_KEY);
      this.held = false;
      this.pendingSwitch.set(null);
      this.account.set(next);
      this.accountListener?.(next, true);
      for (const name of this.docs.keys()) void this.mergeDoc(name, next);
    } catch (err) {
      console.warn('[sync] switch', err);
    } finally {
      this.busy.set(false);
    }
  }

  /** The person keeps the device as it is: leave the new account alone and stay local-only. */
  async cancelSwitch() {
    if (!this.pendingSwitch()) return;
    this.busy.set(true);
    try {
      const s = await this.session;
      if (s) await s.authMod.signOut(s.auth);
      this.write(SIGNED_OUT_KEY, '1');
      this.account.set(null);
    } finally {
      this.pendingSwitch.set(null);
      this.held = false;
      this.busy.set(false);
    }
  }

  /**
   * Signs out of Google. Everything this account produced here goes up first, then the device keeps its
   * data but stops writing to the cloud — a throwaway anonymous account would only strand what comes next.
   */
  async signOut() {
    const s = await this.session;
    if (!s) return;
    this.busy.set(true);
    try {
      await Promise.all([
        this.flushState(),
        ...[...this.docTimers.keys()].map((name) => this.flushDoc(name)),
        this.deviceHooks?.flush() ?? Promise.resolve(),
      ]);
      await s.authMod.signOut(s.auth);
      this.write(SIGNED_OUT_KEY, '1');
      this.account.set(null);
    } catch (err) {
      console.warn('[sync] sign-out', err);
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
      // Coming back from a redirect sign-in (in-app browsers, see signInByRedirect): finish it first.
      try {
        const result = await authMod.getRedirectResult(auth);
        // A link keeps the same uid, so everything this device holds is already up there.
        if (result?.operationType === 'link') this.markPulled(result.user.uid);
      } catch (err) {
        const code = (err as { code?: string }).code;
        const credential =
          code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use'
            ? authMod.GoogleAuthProvider.credentialFromError(err as never)
            : null;
        if (credential) await authMod.signInWithCredential(auth, credential);
        else console.warn('[sync] redirect sign-in', err);
      }
      authMod.onAuthStateChanged(auth, (user) => this.setAccount(user));
      // After an explicit sign-out the device stays local-only until someone signs in again.
      if (!auth.currentUser && !this.read(SIGNED_OUT_KEY)) await authMod.signInAnonymously(auth);
      this.status.set('ready');
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
          void this.flushState();
          for (const name of [...this.docTimers.keys()]) void this.flushDoc(name);
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && !this.held) {
            const current = this.account();
            if (current && !current.anonymous) {
              for (const name of this.docs.keys()) void this.mergeDoc(name, current);
              this.accountListener?.(current, false);
            }
          }
        });
      }
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

    // Another person's account on a device that still holds someone else's khatmas: freeze and ask first.
    if (isDeviceTakeover(this.read(OWNER_KEY), next)) {
      this.held = true;
      this.pendingSwitch.set(next);
      return;
    }

    this.forget(SIGNED_OUT_KEY);
    if (!next.anonymous) this.write(OWNER_KEY, next.uid);
    const prev = this.account();
    this.account.set(next);
    if (prev?.uid !== next.uid || prev?.anonymous !== next.anonymous) {
      this.accountListener?.(next, this.isNewHere(next));
      for (const name of this.docs.keys()) void this.mergeDoc(name, next);
    }
  }

  /** A permanent account this device has not downloaded yet. */
  private isNewHere(account: CloudAccount) {
    if (account.anonymous) return false;
    return this.read(PULLED_KEY) !== account.uid;
  }

  private read(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private mode: the account is verified again next time, which is harmless.
    }
  }

  private forget(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // As above.
    }
  }
}
