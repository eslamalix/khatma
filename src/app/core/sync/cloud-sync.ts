import { Injectable, signal } from '@angular/core';
import type { Firestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import type { Reading, ReadingState } from '../reading/reading';
import { surahAtPage } from '../quran/quran-meta';

type SyncStatus = 'connecting' | 'ready' | 'offline';

interface Session {
  db: Firestore;
  uid: string;
  fs: typeof import('firebase/firestore');
}

/**
 * Mirrors device data to Firestore under an anonymous account (docs/DECISIONS.md P1, T3).
 * Firebase is loaded lazily so it never slows the first paint, and the app works fully without it.
 */
@Injectable({ providedIn: 'root' })
export class CloudSync {
  readonly status = signal<SyncStatus>('connecting');
  private readonly session = this.connect();

  pushReadings(readings: Reading[], onSynced: (ids: string[]) => void) {
    this.session.then(async (s) => {
      if (!s || !readings.length) return;
      const batch = s.fs.writeBatch(s.db);
      for (const { synced, ...r } of readings) {
        batch.set(s.fs.doc(s.db, 'users', s.uid, 'readings', r.id), r);
      }
      await batch.commit();
      onSynced(readings.map((r) => r.id));
    }).catch((err) => console.warn('[sync] readings', err));
  }

  /** The only document family members will be allowed to see (P11). */
  pushStatus(state: ReadingState) {
    this.session.then((s) => {
      if (!s) return;
      return s.fs.setDoc(s.fs.doc(s.db, 'users', s.uid, 'status', 'public'), {
        lastPage: state.lastPage,
        surah: surahAtPage(state.lastPage),
        khatma: state.currentKhatma,
        lastReadAt: state.lastReadAt,
      });
    }).catch((err) => console.warn('[sync] status', err));
  }

  private async connect(): Promise<Session | null> {
    try {
      const [{ initializeApp }, auth, fs] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/firestore'),
      ]);
      const app = initializeApp(environment.firebase);
      const db = fs.initializeFirestore(app, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
      });
      const firebaseAuth = auth.getAuth(app);
      const user = firebaseAuth.currentUser ?? (await auth.signInAnonymously(firebaseAuth)).user;
      this.status.set('ready');
      return { db, uid: user.uid, fs };
    } catch (err) {
      console.warn('[sync] unavailable, staying device-only', err);
      this.status.set('offline');
      return null;
    }
  }
}
