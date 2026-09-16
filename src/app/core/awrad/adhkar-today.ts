import { Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import { toDateStr } from '../calendar/calendar-data';
import { AdhkarCategory } from './awrad-data';

const ADHKAR_DONE_KEY = 'khatma.adhkar.done';

export type AdhkarPeriod = AdhkarCategory['id'];

/**
 * Adhkar cycle day key:
 * The day starts at Fajr (04:00 AM).
 * Times between 00:00 and 03:59 belong to the night cycle of the previous day.
 */
export function adhkarDayKey(date = new Date()): string {
  const d = new Date(date);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return toDateStr(d);
}

/**
 * Windows without prayer times:
 * - Morning adhkar: from 04:00 AM until 12:00 PM (after Fajr until noon).
 * - Evening adhkar: from 15:00 (03:00 PM) through the night until 04:00 AM (after Asr until Fajr).
 * - Noon window (12:00 PM to 03:00 PM): null.
 */
export function adhkarPeriodAt(date = new Date()): AdhkarPeriod | null {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'morning';
  if (h >= 15 || h < 4) return 'evening';
  return null;
}

/** Which adhkar are due now and which were completed today (remembered on this device, reset daily at Fajr). */
@Injectable({ providedIn: 'root' })
export class AdhkarToday {
  private activeDayKey = this.dayKey();
  readonly currentPeriod = signal<AdhkarPeriod | null>(adhkarPeriodAt());
  readonly doneToday = signal<ReadonlySet<string>>(this.load());
  readonly countsToday = signal<Record<string, number>>(this.loadCounts());
  private readonly cloud = injectOptional(CloudSync);
  private timerId?: ReturnType<typeof setInterval>;

  constructor() {
    this.cloud?.registerDoc<{ date: string; ids: string[]; counts?: Record<string, number> }>({
      name: 'adhkar',
      read: () => ({ data: { date: this.dayKey(), ids: [...this.doneToday()], counts: this.countsToday() }, updatedAt: this.savedAt() }),
      apply: (data) => {
        if (data.date !== this.dayKey()) return;
        const mergedIds = new Set([...this.doneToday(), ...(data.ids || [])]);
        this.doneToday.set(mergedIds);
        
        const mergedCounts = { ...this.countsToday() };
        for (const [k, v] of Object.entries(data.counts || {})) {
           mergedCounts[k] = Math.max(mergedCounts[k] || 0, v);
        }
        this.countsToday.set(mergedCounts);
        this.saveState(mergedIds, mergedCounts, false);
      },
      merge: (remoteData, remoteUpdatedAt) => {
        if (remoteData.date !== this.dayKey()) return;
        const mergedIds = new Set([...this.doneToday(), ...(remoteData.ids || [])]);
        this.doneToday.set(mergedIds);
        
        const mergedCounts = { ...this.countsToday() };
        for (const [k, v] of Object.entries(remoteData.counts || {})) {
           mergedCounts[k] = Math.max(mergedCounts[k] || 0, v as number);
        }
        this.countsToday.set(mergedCounts);
        this.saveState(mergedIds, mergedCounts, false);
      },
      reset: () => {
        try {
          localStorage.removeItem(ADHKAR_DONE_KEY);
        } catch {
          // Nothing kept, nothing to clear.
        }
        this.doneToday.set(new Set());
        this.countsToday.set({});
      },
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.refresh();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => this.refresh());
      this.timerId = setInterval(() => this.refresh(), 30_000);
    }
  }

  dayKey(date = new Date()): string {
    return adhkarDayKey(date);
  }

  periodNow(): AdhkarPeriod | null {
    return this.currentPeriod();
  }

  refresh() {
    const nextPeriod = adhkarPeriodAt();
    if (this.currentPeriod() !== nextPeriod) {
      this.currentPeriod.set(nextPeriod);
    }
    const currentKey = this.dayKey();
    if (currentKey !== this.activeDayKey) {
      this.activeDayKey = currentKey;
      this.doneToday.set(this.load());
      this.countsToday.set(this.loadCounts());
    }
  }

  isDone(id: string) {
    return this.doneToday().has(id);
  }

  markDone(id: string) {
    if (this.isDone(id)) return;
    const next = new Set(this.doneToday()).add(id);
    this.doneToday.set(next);
    this.saveState(next, this.countsToday(), true);
  }

  saveCounts(counts: Record<string, number>) {
    this.countsToday.set(counts);
    this.saveState(this.doneToday(), counts, true);
  }

  private saveState(ids: ReadonlySet<string>, counts: Record<string, number>, upload: boolean) {
    try {
      localStorage.setItem(ADHKAR_DONE_KEY, JSON.stringify({ date: this.dayKey(), ids: [...ids], counts, at: Date.now() }));
    } catch {
      // Not remembered; still shown as done for this visit.
    }
    if (upload) this.cloud?.touchDoc('adhkar');
  }

  private savedAt(): number {
    try {
      return (JSON.parse(localStorage.getItem(ADHKAR_DONE_KEY) ?? 'null') as { at?: number } | null)?.at ?? 0;
    } catch {
      return 0;
    }
  }

  private load(): ReadonlySet<string> {
    try {
      const saved = JSON.parse(localStorage.getItem(ADHKAR_DONE_KEY) ?? 'null') as { date: string; ids: string[] } | null;
      return new Set(saved?.date === this.dayKey() ? (saved.ids || []) : []);
    } catch {
      return new Set();
    }
  }

  private loadCounts(): Record<string, number> {
    try {
      const saved = JSON.parse(localStorage.getItem(ADHKAR_DONE_KEY) ?? 'null') as { date: string; counts?: Record<string, number> } | null;
      return saved?.date === this.dayKey() ? (saved.counts || {}) : {};
    } catch {
      return {};
    }
  }
}
