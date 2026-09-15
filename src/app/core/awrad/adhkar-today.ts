import { Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import { toDateStr } from '../calendar/calendar-data';
import { AdhkarCategory } from './awrad-data';

const ADHKAR_DONE_KEY = 'khatma.adhkar.done';

export type AdhkarPeriod = AdhkarCategory['id'];

/** Rough windows without prayer times: morning adhkar after Fajr until noon, evening from Asr into the night. */
export function adhkarPeriodAt(date = new Date()): AdhkarPeriod | null {
  const h = date.getHours();
  if (h >= 4 && h < 12) return 'morning';
  if (h >= 15) return 'evening';
  return null;
}

/** Which adhkar are due now and which were completed today (remembered on this device, reset daily). */
@Injectable({ providedIn: 'root' })
export class AdhkarToday {
  readonly doneToday = signal<ReadonlySet<string>>(this.load());
  readonly countsToday = signal<Record<string, number>>(this.loadCounts());
  private readonly cloud = injectOptional(CloudSync);

  constructor() {
    this.cloud?.registerDoc<{ date: string; ids: string[]; counts?: Record<string, number> }>({
      name: 'adhkar',
      read: () => ({ data: { date: toDateStr(new Date()), ids: [...this.doneToday()], counts: this.countsToday() }, updatedAt: this.savedAt() }),
      apply: (data) => {
        if (data.date !== toDateStr(new Date())) return;
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
        if (remoteData.date !== toDateStr(new Date())) return;
        const mergedIds = new Set([...this.doneToday(), ...(remoteData.ids || [])]);
        this.doneToday.set(mergedIds);
        
        const mergedCounts = { ...this.countsToday() };
        for (const [k, v] of Object.entries(remoteData.counts || {})) {
           mergedCounts[k] = Math.max(mergedCounts[k] || 0, v as number);
        }
        this.countsToday.set(mergedCounts);
        this.saveState(mergedIds, mergedCounts, false);
      }
    });
  }

  periodNow() {
    return adhkarPeriodAt();
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
      localStorage.setItem(ADHKAR_DONE_KEY, JSON.stringify({ date: toDateStr(new Date()), ids: [...ids], counts, at: Date.now() }));
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
      return new Set(saved?.date === toDateStr(new Date()) ? (saved.ids || []) : []);
    } catch {
      return new Set();
    }
  }

  private loadCounts(): Record<string, number> {
    try {
      const saved = JSON.parse(localStorage.getItem(ADHKAR_DONE_KEY) ?? 'null') as { date: string; counts?: Record<string, number> } | null;
      return saved?.date === toDateStr(new Date()) ? (saved.counts || {}) : {};
    } catch {
      return {};
    }
  }
}
