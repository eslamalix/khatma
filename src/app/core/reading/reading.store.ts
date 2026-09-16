import { computed, inject, Injectable, isDevMode, signal } from '@angular/core';
import { localDb } from '../db/local-db';
import { CloudAccount, CloudSync } from '../sync/cloud-sync';
import { clampPage } from '../quran/quran-meta';
import { demoData } from '../dev/demo-data';
import { computeKpis, latestSurahInsight, pageRows } from './kpi';
import { wirdStreak, wirdToday } from './wird';
import { BackgroundTheme, DEFAULT_STATE, pendingFor, Reading, ReadingMode, ReadingState } from './reading';
import { PageVisit } from '../timing/timing-engine';

const STATE_KEY = 'state';

/** All reading data for the app: device-first, mirrored to the cloud when signed in. */
@Injectable({ providedIn: 'root' })
export class ReadingStore {
  private readonly cloud = inject(CloudSync);
  /** `?demo` in development: sample data kept in memory only. */
  private readonly demo = isDevMode() && new URLSearchParams(location.search).has('demo');

  readonly readings = signal<Reading[]>([]);
  readonly state = signal<ReadingState>(DEFAULT_STATE);
  readonly ready = signal(false);

  readonly kpis = computed(() => computeKpis(this.readings(), this.state().currentKhatma));
  readonly insight = computed(() => latestSurahInsight(this.readings(), this.state().currentKhatma));
  readonly rows = computed(() => pageRows(this.readings(), this.state().currentKhatma));
  /** Today's wird progress, or null before a daily goal is chosen. */
  readonly wird = computed(() => {
    const goal = this.state().dailyGoalPages;
    return goal ? wirdToday(this.readings(), goal) : null;
  });
  readonly streak = computed(() => {
    const goal = this.state().dailyGoalPages;
    return goal ? wirdStreak(this.readings(), goal) : 0;
  });

  private readonly loading = this.load();

  constructor() {
    this.cloud.onAccount((account, isNewHere) => void this.mergeAccount(account, isNewHere));
    this.cloud.registerDevice({ flush: () => this.flushDevice(), wipe: () => this.wipeDevice() });
  }

  whenReady() {
    return this.loading;
  }

  async addVisit(visit: PageVisit) {
    const reading: Reading = { id: crypto.randomUUID(), khatma: this.state().currentKhatma, synced: 0, ...visit };
    this.readings.update((list) => [...list, reading]);
    if (this.demo) return;
    try {
      await (await localDb()).put('readings', reading);
    } catch (err) {
      console.warn('[reading.store] addVisit', err);
    }
    void this.cloud.pushReadings([reading], (ids, uid) => void this.markSynced(ids, uid));
  }

  setLastPage(page: number) {
    this.patchState({ lastPage: clampPage(page), lastReadAt: Date.now() });
  }

  setFontScale(fontScale: number) {
    this.patchState({ fontScale: Math.min(2, Math.max(0.7, Math.round(fontScale * 100) / 100)) });
  }

  setBackgroundTheme(backgroundTheme: BackgroundTheme) {
    this.patchState({ backgroundTheme });
  }

  setDailyGoal(pages: number) {
    this.patchState({ dailyGoalPages: Math.min(604, Math.max(1, Math.round(pages))) });
  }

  setReadingMode(readingMode: ReadingMode) {
    this.patchState({ readingMode });
  }

  startNewKhatma() {
    this.patchState({ currentKhatma: this.state().currentKhatma + 1, lastPage: 1 });
  }

  private patchState(patch: Partial<ReadingState>) {
    this.state.update((s) => ({ ...s, ...patch }));
    if (this.demo) return;
    localDb()
      .then((db) => db.put('kv', this.state(), STATE_KEY))
      .catch((err) => console.warn('[reading.store] patchState', err));
    this.cloud.pushState(this.state());
  }

  /**
   * An account is in play on this device. If the device has not seen it before (e.g. Google on a second
   * phone) its history is downloaded and merged; either way everything the account has never received is
   * uploaded — including readings recorded while signed out — and the newer reading position wins.
   */
  private async mergeAccount(account: CloudAccount, isNewHere: boolean) {
    if (this.demo) return;
    try {
      await this.loading;

      // Always pull the state to ensure the current device knows the latest lastPage.
      // Only pull readings history if this is a new device to save Firebase Spark quota.
      const snap = await this.cloud.pull(isNewHere).catch((err) => (console.warn('[sync] pull', err), null));
      if (!snap) return;

      if (isNewHere) {
        const localIds = new Set(this.readings().map((r) => r.id));
        const incoming = snap.readings.filter((r) => !localIds.has(r.id));
        if (incoming.length) {
          this.readings.update((list) => [...list, ...incoming].sort((a, b) => a.endAt - b.endAt));
          const db = await localDb();
          const tx = db.transaction('readings', 'readwrite');
          for (const r of incoming) tx.store.put(r);
          await tx.done;
        }
        // Whatever the account already holds needs no upload; anything else is sent below.
        await this.markSynced(snap.readings.map((r) => r.id), account.uid);
        const missing = await this.pushPending(account.uid);
        console.info(`[sync] merged account ${account.uid}: +${incoming.length} here, +${missing} there`);
      } else {
        // This device has synced with this very account before, so the old flag means "already up there".
        await this.markSynced(this.readings().filter((r) => r.synced && !r.syncedTo).map((r) => r.id), account.uid);
        const missing = await this.pushPending(account.uid);
        console.info(`[sync] verified account ${account.uid}: +${missing} there`);
      }

      const cloudState = snap.state;
      if (cloudState && (cloudState.lastReadAt ?? 0) > (this.state().lastReadAt ?? 0)) {
        this.state.update((s) => ({ ...s, ...cloudState }));
        await (await localDb()).put('kv', this.state(), STATE_KEY);
      } else if (isNewHere) {
        this.cloud.pushState(this.state());
      }
    } catch (err) {
      console.warn('[reading.store] mergeAccount', err);
    }
  }

  private async load() {
    if (this.demo) {
      const { readings, state } = demoData();
      this.readings.set(readings);
      this.state.set({ ...DEFAULT_STATE, ...state });
      this.ready.set(true);
      return;
    }
    const db = await localDb();
    const [readings, state] = await Promise.all([db.getAll('readings'), db.get('kv', STATE_KEY)]);
    this.readings.set(readings.sort((a, b) => a.endAt - b.endAt));
    this.state.set({ ...DEFAULT_STATE, ...state });
    this.ready.set(true);
    // Uploading is left to mergeAccount: it knows which account is signed in, and what that account already has.
  }

  /** Send every reading this account has not received yet; returns how many went up. */
  private async pushPending(uid: string) {
    const pending = pendingFor(this.readings(), uid);
    if (pending.length) await this.cloud.pushReadings(pending, (ids, to) => void this.markSynced(ids, to));
    return pending.length;
  }

  /** Before signing out: nothing this account produced may be left behind on the device alone. */
  private async flushDevice() {
    const uid = this.cloud.account()?.uid;
    if (this.demo || !uid) return;
    await this.loading;
    await this.pushPending(uid);
  }

  /** Another person's account is taking this device over: their khatmas start from what the cloud holds. */
  private async wipeDevice() {
    if (this.demo) return;
    await this.loading;
    this.readings.set([]);
    this.state.set(DEFAULT_STATE);
    try {
      const db = await localDb();
      await db.clear('readings');
      await db.delete('kv', STATE_KEY);
    } catch (err) {
      console.warn('[reading.store] wipeDevice', err);
    }
  }

  private async markSynced(ids: string[], uid: string) {
    if (!ids.length) return;
    const set = new Set(ids);
    this.readings.update((list) => list.map((r) => (set.has(r.id) ? { ...r, synced: 1 as const, syncedTo: uid } : r)));
    try {
      const db = await localDb();
      const tx = db.transaction('readings', 'readwrite');
      for (const r of this.readings()) if (set.has(r.id)) tx.store.put(r);
      await tx.done;
    } catch (err) {
      console.warn('[reading.store] markSynced', err);
    }
  }
}
