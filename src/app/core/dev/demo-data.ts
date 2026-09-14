import { Reading, ReadingState } from '../reading/reading';
import { TOTAL_PAGES } from '../quran/quran-meta';

/**
 * Development-only sample data (open any screen with `?demo`): a finished first khatma and the
 * second khatma through Al-Baqarah, mirroring the numbers used in the design mockups.
 */
export function demoData(now = Date.now()): { readings: Reading[]; state: ReadingState } {
  const readings: Reading[] = [];
  let seed = 7;
  const jitter = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 16_000;
  const DAY = 86_400_000;

  const add = (page: number, khatma: number, durationMs: number, endAt: number) =>
    readings.push({ id: `demo-${khatma}-${page}`, page, khatma, startAt: endAt - durationMs, endAt, durationMs, synced: 1 });

  // Khatma 1: finished two days ago, ~70 s per page, Al-Baqarah slower.
  let t = now - 44 * DAY;
  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const ms = page >= 2 && page <= 49 ? 78_000 + jitter() / 4 : 70_000 + jitter();
    t += ms + (page % 15 === 0 ? DAY / 15 : 4_000);
    add(page, 1, Math.round(ms), Math.round(t));
  }

  // Khatma 2: yesterday and the day before, ~64 s per page.
  t = now - 2 * DAY;
  for (let page = 1; page <= 49; page++) {
    const ms = 64_000 + jitter() / 2;
    t += ms + (page === 16 || page === 33 ? DAY / 3 : 3_000);
    add(page, 2, Math.round(ms), Math.round(t));
  }

  return { readings, state: { currentKhatma: 2, lastPage: 50, lastReadAt: t, fontScale: 1, backgroundTheme: 'auto', readingMode: 'horizontal' } };
}
