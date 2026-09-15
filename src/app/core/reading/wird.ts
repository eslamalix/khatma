import { toDateStr } from '../calendar/calendar-data';
import { Reading } from './reading';

export const WIRD_PRESETS = [2, 5, 10, 20] as const;

export interface WirdToday {
  goal: number;
  /** Distinct pages read today. */
  read: number;
  remaining: number;
  done: boolean;
  /** 0..1 */
  ratio: number;
}

/** Distinct pages read on each local calendar day. */
export function pagesByDay(readings: readonly Reading[]): Map<string, number> {
  const sets = new Map<string, Set<number>>();
  for (const r of readings) {
    const key = toDateStr(new Date(r.startAt));
    let set = sets.get(key);
    if (!set) sets.set(key, (set = new Set()));
    set.add(r.page);
  }
  return new Map([...sets].map(([day, set]) => [day, set.size]));
}

export function wirdToday(readings: readonly Reading[], goal: number, now = new Date()): WirdToday {
  const read = pagesByDay(readings).get(toDateStr(now)) ?? 0;
  return { goal, read, remaining: Math.max(0, goal - read), done: read >= goal, ratio: Math.min(1, read / goal) };
}

/**
 * Consecutive days on which the wird was completed. Today counts once it is done; until then an
 * unfinished today does not break a streak that ran through yesterday.
 */
export function wirdStreak(readings: readonly Reading[], goal: number, now = new Date()): number {
  const byDay = pagesByDay(readings);
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if ((byDay.get(toDateStr(day)) ?? 0) < goal) day.setDate(day.getDate() - 1);
  let streak = 0;
  while ((byDay.get(toDateStr(day)) ?? 0) >= goal) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

/** Days to finish the remaining pages at `goal` pages a day. */
export const daysAtWird = (remainingPages: number, goal: number) => Math.max(1, Math.ceil(remainingPages / goal));
