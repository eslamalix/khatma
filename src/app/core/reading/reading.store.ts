import { computed, inject, Injectable, isDevMode, signal } from '@angular/core';
import { localDb } from '../db/local-db';
import { CloudSync } from '../sync/cloud-sync';
import { clampPage } from '../quran/quran-meta';
import { demoData } from '../dev/demo-data';
import { computeKpis, latestSurahInsight, pageRows } from './kpi';
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

  private readonly loading = this.load();

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
    if (!this.demo) this.cloud.pushStatus(this.state());
  }

  setFontScale(fontScale: number) {
    this.patchState({ fontScale: Math.min(2, Math.max(0.7, Math.round(fontScale * 100) / 100)) });
  }

  setBackgroundTheme(backgroundTheme: BackgroundTheme) {
    this.patchState({ backgroundTheme });
  }

  setReadingMode(readingMode: ReadingMode) {
    this.patchState({ readingMode });
  }

  startNewKhatma() {
    this.patchState({ currentKhatma: this.state().currentKhatma + 1, lastPage: 1 });
  }

  private patchState(patch: Partial<ReadingState>) {
    this.state.update((s) => ({ ...s, ...patch }));
    if (!this.demo) localDb().then((db) => db.put('kv', this.state(), STATE_KEY));
  }

  private async load() {
    if (this.demo) {
      const { readings, state } = demoData();
      this.readings.set(readings);
      this.state.set(state);
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
