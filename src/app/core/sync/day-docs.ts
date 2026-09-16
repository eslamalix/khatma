import { pendingFor, Reading, ReadingState } from '../reading/reading';
import { toDateStr } from '../calendar/calendar-data';
import { latestByPage } from '../reading/kpi';

/** A page visit as it is stored in the cloud: the device-only sync flags are stripped. */
export type StoredVisit = Omit<Reading, 'synced' | 'syncedTo'>;

/**
 * One day of reading as a single document (`users/{uid}/days/{YYYY-MM-DD}`). A document per page visit
 * cost a write per page and thousands of reads to restore an account, which the free Spark quota — shared
 * by every reader — cannot carry. The day also happens to be the unit an owner dashboard wants to chart,
 * so the totals are stored next to the visits instead of being recomputed from them.
 */
export interface DayDoc {
  /** YYYY-MM-DD in the reader's local time, so a day means the day they experienced. */
  date: string;
  visits: StoredVisit[];
  /** Distinct pages counted that day. */
  pages: number;
  totalMs: number;
  /** The last khatma this day contributed to. */
  khatma: number;
  firstAt: number;
  lastAt: number;
  updatedAt: number;
}

/**
 * What the owner's dashboard reads: one document per reader (`users/{uid}`), so listing everybody costs
 * one read each instead of scanning their history. It holds no ayah-level detail, only totals.
 */
export interface OwnerSummary {
  khatma: number;
  lastPage: number;
  lastReadAt: number | null;
  /** Total active reading time across every khatma. */
  totalMs: number;
  /** Distinct pages counted in the current khatma. */
  pagesThisKhatma: number;
  /** Page visits counted across every khatma. */
  visits: number;
  /** Days with any reading at all. */
  readingDays: number;
  firstReadAt: number | null;
  dailyGoalPages: number | null;
  name: string | null;
  email: string | null;
  anonymous: boolean;
  appVersion: string;
  updatedAt: number;
}

export const dayKeyOf = (reading: Reading | StoredVisit) => toDateStr(new Date(reading.startAt));

/** Everything the cloud keeps for one day, built from the readings this device holds for it. */
export function dayDocOf(date: string, readings: readonly Reading[], now = Date.now()): DayDoc {
  const visits = readings.map(({ synced, syncedTo, ...visit }) => visit).sort((a, b) => a.startAt - b.startAt);
  return {
    date,
    visits,
    pages: new Set(visits.map((v) => v.page)).size,
    totalMs: visits.reduce((sum, v) => sum + v.durationMs, 0),
    khatma: visits.length ? visits[visits.length - 1].khatma : 1,
    firstAt: visits.length ? visits[0].startAt : now,
    lastAt: visits.reduce((last, v) => Math.max(last, v.endAt), 0),
    updatedAt: now,
  };
}

/** The days that hold readings this account has never received. */
export function pendingDays(readings: readonly Reading[], uid: string): string[] {
  return [...new Set(pendingFor(readings, uid).map(dayKeyOf))].sort();
}

/**
 * Two phones can both read on the same day, so a day document is merged rather than replaced: visits are
 * matched by id and the longer one wins, because a visit only ever grows as the reader stays on the page.
 */
export function mergeDay(mine: DayDoc, theirs: DayDoc | undefined, now = Date.now()): DayDoc {
  if (!theirs?.visits?.length) return mine;
  const byId = new Map(mine.visits.map((v) => [v.id, v]));
  for (const visit of theirs.visits) {
    const existing = byId.get(visit.id);
    if (!existing || visit.durationMs > existing.durationMs) byId.set(visit.id, visit);
  }
  return dayDocOf(mine.date, [...byId.values()].map((v) => ({ ...v, synced: 1 as const })), now);
}

/** Rebuilds the flat reading list the app works with, tagged as already stored in this account. */
export function readingsFromDays(days: readonly DayDoc[], uid: string): Reading[] {
  return days
    .flatMap((day) => day.visits ?? [])
    .map((visit) => ({ ...visit, synced: 1 as const, syncedTo: uid }))
    .sort((a, b) => a.endAt - b.endAt);
}

/** The per-reader totals an owner dashboard lists, computed from what the device already holds. */
export function summaryOf(
  readings: readonly Reading[],
  state: ReadingState,
  account: { name: string | null; email: string | null; anonymous: boolean },
  appVersion: string,
  now = Date.now(),
): OwnerSummary {
  const days = new Set(readings.map(dayKeyOf));
  return {
    khatma: state.currentKhatma,
    lastPage: state.lastPage,
    lastReadAt: state.lastReadAt,
    totalMs: readings.reduce((sum, r) => sum + r.durationMs, 0),
    pagesThisKhatma: latestByPage(readings, state.currentKhatma).size,
    visits: readings.length,
    readingDays: days.size,
    firstReadAt: readings.reduce<number | null>((first, r) => (first === null ? r.startAt : Math.min(first, r.startAt)), null),
    dailyGoalPages: state.dailyGoalPages,
    name: account.name,
    email: account.email,
    anonymous: account.anonymous,
    appVersion,
    updatedAt: now,
  };
}
