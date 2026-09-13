import { TOTAL_PAGES, juzAtPage, surahAtPage, surahPages } from '../quran/quran-meta';
import { Reading } from './reading';

/** Shown until the reader has enough of their own data. */
export const ESTIMATE_MS_PER_PAGE = 60_000;
export const MIN_READINGS_FOR_AVERAGE = 5;

export interface Kpis {
  avgMs: number;
  /** True while the average is not yet based on enough real readings. */
  estimated: boolean;
  khatmaMs: number;
  pagesRead: number;
  remainingPages: number;
  remainingMs: number;
  remainingRatio: number;
  totalReadMs: number;
}

export function computeKpis(readings: readonly Reading[], khatma: number): Kpis {
  const totalReadMs = readings.reduce((sum, r) => sum + r.durationMs, 0);
  const avgMs = readings.length ? totalReadMs / readings.length : ESTIMATE_MS_PER_PAGE;
  const pagesRead = latestByPage(readings, khatma).size;
  const remainingPages = TOTAL_PAGES - pagesRead;
  return {
    avgMs,
    estimated: readings.length < MIN_READINGS_FOR_AVERAGE,
    khatmaMs: avgMs * TOTAL_PAGES,
    pagesRead,
    remainingPages,
    remainingMs: avgMs * remainingPages,
    remainingRatio: remainingPages / TOTAL_PAGES,
    totalReadMs,
  };
}

/** Most recent reading of every page within one khatma. */
export function latestByPage(readings: readonly Reading[], khatma: number): Map<number, Reading> {
  const map = new Map<number, Reading>();
  for (const r of readings) {
    if (r.khatma !== khatma) continue;
    const prev = map.get(r.page);
    if (!prev || r.endAt > prev.endAt) map.set(r.page, r);
  }
  return map;
}

/** Latest reading of a page in the most recent khatma before `khatma`. */
function previousReading(readings: readonly Reading[], page: number, khatma: number): Reading | undefined {
  let best: Reading | undefined;
  for (const r of readings) {
    if (r.page !== page || r.khatma >= khatma) continue;
    if (!best || r.khatma > best.khatma || (r.khatma === best.khatma && r.endAt > best.endAt)) best = r;
  }
  return best;
}

export interface SurahTime {
  surah: number;
  durationMs: number;
  finishedAt: number;
}

/** A surah's reading time in a khatma, or null if not every page of it was read. */
export function surahTime(readings: readonly Reading[], surah: number, khatma: number): SurahTime | null {
  const latest = latestByPage(readings, khatma);
  const { from, to } = surahPages(surah);
  let durationMs = 0;
  let finishedAt = 0;
  for (let p = from; p <= to; p++) {
    const r = latest.get(p);
    if (!r) return null;
    durationMs += r.durationMs;
    finishedAt = Math.max(finishedAt, r.endAt);
  }
  return { surah, durationMs, finishedAt };
}

export interface SurahInsight extends SurahTime {
  previousMs?: number;
  /** Positive = faster than last time (0.18 → 18% faster). */
  change?: number;
}

/** The most recently finished surah of at least `minPages` pages, compared with the khatma before. */
export function latestSurahInsight(readings: readonly Reading[], khatma: number, minPages = 3): SurahInsight | null {
  let best: SurahTime | null = null;
  let bestKhatma = khatma;
  for (const k of [khatma, khatma - 1]) {
    if (k < 1) continue;
    for (let s = 1; s <= 114; s++) {
      const { from, to } = surahPages(s);
      if (to - from + 1 < minPages) continue;
      const t = surahTime(readings, s, k);
      if (t && (!best || t.finishedAt > best.finishedAt)) {
        best = t;
        bestKhatma = k;
      }
    }
    if (best) break;
  }
  if (!best) return null;
  const prev = bestKhatma > 1 ? surahTime(readings, best.surah, bestKhatma - 1) : null;
  return prev
    ? { ...best, previousMs: prev.durationMs, change: (prev.durationMs - best.durationMs) / prev.durationMs }
    : best;
}

export const daysToFinish = (khatmaMs: number, minutesPerDay: number) =>
  Math.max(1, Math.ceil(khatmaMs / (minutesPerDay * 60_000)));

export interface PageRow {
  page: number;
  surah: number;
  juz: number;
  current?: Reading;
  previous?: Reading;
  bestMs?: number;
  /** Positive = faster than the previous khatma. */
  change?: number;
}

/** The fixed 604-row table. */
export function pageRows(readings: readonly Reading[], khatma: number): PageRow[] {
  const latest = latestByPage(readings, khatma);
  const best = new Map<number, number>();
  for (const r of readings) best.set(r.page, Math.min(best.get(r.page) ?? Infinity, r.durationMs));
  const rows: PageRow[] = [];
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const current = latest.get(page);
    const previous = previousReading(readings, page, khatma);
    rows.push({
      page,
      surah: surahAtPage(page),
      juz: juzAtPage(page),
      current,
      previous,
      bestMs: best.get(page),
      change: current && previous ? (previous.durationMs - current.durationMs) / previous.durationMs : undefined,
    });
  }
  return rows;
}
