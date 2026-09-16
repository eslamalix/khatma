import { computed, inject, Injectable, isDevMode, signal } from '@angular/core';
import { localDb } from '../db/local-db';
import { CloudAccount, CloudSync } from '../sync/cloud-sync';
import { clampPage } from '../quran/quran-meta';
import { demoData } from '../dev/demo-data';
import { computeKpis, latestSurahInsight, pageRows } from './kpi';
import { wirdStreak, wirdToday } from './wird';
import { BackgroundTheme, DEFAULT_STATE, Reading, ReadingMode, ReadingState } from './reading';
import { PageVisit } from '../timing/timing-engine';
import { DayDoc, dayDocOf, dayKeyOf, pendingDays, readingsFromDays, summaryOf } from '../sync/day-docs';
import packageJson from '../../../../package.json';

const STATE_KEY = 'state';
/**
 * How long page visits pile up before the day they belong to is written to the cloud. Wide on purpose:
 * one document per day is rewritten each time, so a short window would cost a write every few seconds.
 * A page hide or a sign-out flushes immediately, and IndexedDB already has everything meanwhile.
 */
const DAY_DEBOUNCE_MS = 300_000;
/** The owner summary is a total, not a live feed; once every quarter hour of reading is plenty. */
const SUMMARY_MIN_MS = 900_000;

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
  private dayTimer: ReturnType<typeof setTimeout> | null = null;
  private summaryAt = 0;

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
    this.scheduleDayFlush();
  }

  private scheduleDayFlush() {
    if (this.dayTimer || this.demo) return;
    this.dayTimer = setTimeout(() => void this.flushDays(), DAY_DEBOUNCE_MS);
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
        // Days the account already holds need no upload. Readings it kept in the older per-visit shape
        // stay untagged on purpose, so the flush below stores them as days and the account moves over.
        await this.markSynced(
          snap.readings.filter((r) => r.syncedTo === account.uid).map((r) => r.id),
          account.uid,
        );
        const days = await this.flushDays();
        console.info(`[sync] merged account ${account.uid}: +${incoming.length} here, ${days} days up`);
      } else {
        const days = await this.flushDays();
        console.info(`[sync] verified account ${account.uid}: ${days} days up`);
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

  /**
   * Writes every day that holds readings this account has not received, as one document per day, and
   * takes back whatever the account already had for those days (another phone reading the same day).
   * Returns how many days went up.
   */
  private async flushDays() {
    if (this.dayTimer) clearTimeout(this.dayTimer);
    this.dayTimer = null;
    const uid = this.cloud.account()?.uid;
    if (this.demo || !uid) return 0;
    await this.loading;

    const dates = new Set(pendingDays(this.readings(), uid));
    if (!dates.size) return 0;
    const byDate = new Map<string, Reading[]>();
    for (const reading of this.readings()) {
      const date = dayKeyOf(reading);
      if (!dates.has(date)) continue;
      const day = byDate.get(date);
      if (day) day.push(reading);
      else byDate.set(date, [reading]);
    }

    const days = [...byDate].map(([date, readings]) => dayDocOf(date, readings));
    await this.cloud.pushDays(days, (stored, to) => void this.adoptStored(stored, to));
    return days.length;
  }

  /** What the account holds for a day it just accepted, including visits this device had never seen. */
  private async adoptStored(stored: DayDoc[], uid: string) {
    const incoming = readingsFromDays(stored, uid);
    const known = new Set(this.readings().map((r) => r.id));
    const fresh = incoming.filter((r) => !known.has(r.id));
    if (fresh.length) this.readings.update((list) => [...list, ...fresh].sort((a, b) => a.endAt - b.endAt));
    await this.markSynced(
      incoming.map((r) => r.id),
      uid,
    );
    await this.pushSummary();
  }

  /** The totals an owner dashboard reads; written rarely, and always at the end of a session. */
  private async pushSummary(force = false) {
    const account = this.cloud.account();
    if (this.demo || !account) return;
    if (!force && Date.now() - this.summaryAt < SUMMARY_MIN_MS) return;
    this.summaryAt = Date.now();
    await this.cloud.pushSummary(summaryOf(this.readings(), this.state(), account, packageJson.version));
  }

  /** Before signing out or hiding the page: nothing this account produced may be left on the device alone. */
  private async flushDevice() {
    if (this.demo || !this.cloud.account()) return;
    await this.flushDays();
    await this.pushSummary(true);
  }

  /** Another person's account is taking this device over: their khatmas start from what the cloud holds. */
  private async wipeDevice() {
    if (this.demo) return;
    await this.loading;
    if (this.dayTimer) clearTimeout(this.dayTimer);
    this.dayTimer = null;
    this.summaryAt = 0;
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
