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
  private readonly cloud = injectOptional(CloudSync);

  constructor() {
    this.cloud?.registerDoc<{ date: string; ids: string[] }>({
      name: 'adhkar',
      read: () => ({ data: { date: toDateStr(new Date()), ids: [...this.doneToday()] }, updatedAt: this.savedAt() }),
      apply: (data) => {
        if (data.date !== toDateStr(new Date()) || !Array.isArray(data.ids)) return;
        const merged = new Set([...this.doneToday(), ...data.ids]);
        this.doneToday.set(merged);
        this.save(merged, false);
      },
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
    this.save(next, true);
  }

  private save(ids: ReadonlySet<string>, upload: boolean) {
    try {
      localStorage.setItem(ADHKAR_DONE_KEY, JSON.stringify({ date: toDateStr(new Date()), ids: [...ids], at: Date.now() }));
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
      return new Set(saved?.date === toDateStr(new Date()) ? saved.ids : []);
    } catch {
      return new Set();
    }
  }
}
