import { computed, inject, Injectable, isDevMode, signal } from '@angular/core';
import { localDb } from '../db/local-db';
import { CloudAccount, CloudSync } from '../sync/cloud-sync';
import { clampPage } from '../quran/quran-meta';
import { demoData } from '../dev/demo-data';
import { computeKpis, latestSurahInsight, pageRows } from './kpi';
import { wirdStreak, wirdToday } from './wird';
import { BackgroundTheme, DEFAULT_STATE, Reading, ReadingMode, ReadingState } from './reading';
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
  }

  whenReady() {
    return this.loading;
  }

  async addVisit(visit: PageVisit) {
    const reading: Reading = { id: crypto.randomUUID(), khatma: this.state().currentKhatma, synced: 0, ...visit };
    this.readings.update((list) => [...list, reading]);
    if (this.demo) return;
    await (await localDb()).put('readings', reading);
    this.cloud.pushReadings([reading], (ids) => this.markSynced(ids));
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
    localDb().then((db) => db.put('kv', this.state(), STATE_KEY));
    this.cloud.pushState(this.state());
  }

  /**
   * Signed into an account this device has not seen (e.g. Google on a second phone): download it,
   * add what is missing here, upload what is missing there, and keep whichever reading position is newer.
   */
  private async mergeAccount(account: CloudAccount, isNewHere: boolean) {
    if (this.demo || !isNewHere) return;
    await this.loading;
    const snap = await this.cloud.pull().catch((err) => (console.warn('[sync] pull', err), null));
    if (!snap) return;

    const localIds = new Set(this.readings().map((r) => r.id));
    const incoming = snap.readings.filter((r) => !localIds.has(r.id));
    if (incoming.length) {
      this.readings.update((list) => [...list, ...incoming].sort((a, b) => a.endAt - b.endAt));
      const db = await localDb();
      const tx = db.transaction('readings', 'readwrite');
      for (const r of incoming) tx.store.put(r);
      await tx.done;
    }

    const cloudIds = new Set(snap.readings.map((r) => r.id));
    const missing = this.readings().filter((r) => !cloudIds.has(r.id));
    if (missing.length) this.cloud.pushReadings(missing, (ids) => this.markSynced(ids));

    const cloudState = snap.state;
    if (cloudState && (cloudState.lastReadAt ?? 0) > (this.state().lastReadAt ?? 0)) {
      this.state.update((s) => ({ ...s, ...cloudState }));
      (await localDb()).put('kv', this.state(), STATE_KEY);
    } else {
      this.cloud.pushState(this.state());
    }
    console.info(`[sync] merged account ${account.uid}: +${incoming.length} here, +${missing.length} there`);
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
    const pending = readings.filter((r) => !r.synced);
    if (pending.length) this.cloud.pushReadings(pending, (ids) => this.markSynced(ids));
  }

  private async markSynced(ids: string[]) {
    const set = new Set(ids);
    this.readings.update((list) => list.map((r) => (set.has(r.id) ? { ...r, synced: 1 } : r)));
    const db = await localDb();
    const tx = db.transaction('readings', 'readwrite');
    for (const r of this.readings()) if (set.has(r.id)) tx.store.put(r);
    await tx.done;
  }
}
