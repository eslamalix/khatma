import { TOTAL_PAGES, SURAH_NAMES, SURAH_START_PAGES, surahAtPage, juzAtPage, surahPages } from '../quran/quran-meta';
import { computeKpis, daysToFinish, latestSurahInsight, pageRows } from './kpi';
import { Reading } from './reading';

let seq = 0;
const reading = (page: number, khatma: number, durationMs: number, endAt = ++seq * 100_000): Reading => ({
  id: `r${seq}`, page, khatma, startAt: endAt - durationMs, endAt, durationMs, synced: 0,
});

/** Al-Baqarah (pages 2–49) read in a khatma at a fixed pace. */
const baqarah = (khatma: number, msPerPage: number) =>
  Array.from({ length: 48 }, (_, i) => reading(i + 2, khatma, msPerPage));

describe('quran metadata', () => {
  it('has 114 surahs', () => {
    expect(SURAH_NAMES).toHaveLength(114);
    expect(SURAH_START_PAGES).toHaveLength(114);
  });

  it('maps pages to surah and juz', () => {
    expect(surahAtPage(50)).toBe(3);
    expect(surahAtPage(49)).toBe(2);
    expect(surahAtPage(604)).toBe(112);
    expect(juzAtPage(50)).toBe(3);
    expect(juzAtPage(604)).toBe(30);
    expect(surahPages(2)).toEqual({ from: 2, to: 49 });
  });
});

describe('computeKpis', () => {
  it('uses an estimate before there is data', () => {
    const k = computeKpis([], 1);
    expect(k.estimated).toBe(true);
    expect(k.khatmaMs).toBe(60_000 * TOTAL_PAGES);
    expect(k.remainingRatio).toBe(1);
  });

  it('matches the design example: 1:04 per page, 49 pages into the second khatma', () => {
    const readings = [reading(1, 2, 64_000), ...baqarah(2, 64_000)];
    const k = computeKpis(readings, 2);
    expect(k.estimated).toBe(false);
    expect(Math.round(k.khatmaMs / 1000)).toBe(10 * 3600 + 44 * 60 + 16);
    expect(k.pagesRead).toBe(49);
    expect(Math.round(k.remainingMs / 1000)).toBe(9 * 3600 + 52 * 60);
    expect(Math.round(k.remainingRatio * 100)).toBe(92);
  });

  it('counts a re-read page once in the khatma', () => {
    const k = computeKpis([reading(5, 1, 60_000), reading(5, 1, 50_000)], 1);
    expect(k.pagesRead).toBe(1);
  });
});

describe('insights', () => {
  it('finds the last finished surah and the improvement over the previous khatma', () => {
    const readings = [...baqarah(1, 78_125), ...baqarah(2, 64_000)];
    const insight = latestSurahInsight(readings, 2)!;
    expect(insight.surah).toBe(2);
    expect(Math.round(insight.durationMs / 60_000)).toBe(51);
    expect(Math.round(insight.previousMs! / 60_000)).toBe(63);
    expect(Math.round(insight.change! * 100)).toBe(18);
  });

  it('returns null when no surah is complete', () => {
    expect(latestSurahInsight([reading(2, 1, 60_000)], 1)).toBeNull();
  });

  it('computes days to finish', () => {
    expect(daysToFinish(644 * 60_000, 51)).toBe(13);
    expect(daysToFinish(644 * 60_000, 30)).toBe(22);
  });

  it('builds 604 rows with change against the previous khatma', () => {
    const rows = pageRows([reading(44, 1, 74_000), reading(44, 2, 62_000)], 2);
    expect(rows).toHaveLength(604);
    expect(rows[43].current?.durationMs).toBe(62_000);
    expect(Math.round(rows[43].change! * 100)).toBe(16);
    expect(rows[43].bestMs).toBe(62_000);
    expect(rows[44].current).toBeUndefined();
  });
});
