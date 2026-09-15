import { Reading } from './reading';
import { daysAtWird, pagesByDay, wirdStreak, wirdToday } from './wird';

const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h).getTime();
const read = (page: number, startAt: number): Reading => ({
  id: `${page}-${startAt}`,
  page,
  khatma: 1,
  startAt,
  endAt: startAt + 60_000,
  durationMs: 60_000,
  synced: 0,
});
const pages = (from: number, count: number, day: number) =>
  Array.from({ length: count }, (_, i) => read(from + i, day + i * 70_000));

describe('wird', () => {
  const now = new Date(2026, 8, 15, 20);

  it('counts distinct pages per day, re-reads counted once', () => {
    const day = at(2026, 9, 15);
    const map = pagesByDay([...pages(10, 3, day), read(10, day + 500_000)]);
    expect(map.get('2026-09-15')).toBe(3);
  });

  it('reports progress toward today’s goal', () => {
    const w = wirdToday(pages(1, 3, at(2026, 9, 15)), 5, now);
    expect(w).toEqual({ goal: 5, read: 3, remaining: 2, done: false, ratio: 0.6 });
    expect(wirdToday(pages(1, 7, at(2026, 9, 15)), 5, now).done).toBe(true);
  });

  it('keeps a streak through yesterday while today is still in progress', () => {
    const readings = [...pages(1, 5, at(2026, 9, 13)), ...pages(6, 5, at(2026, 9, 14)), ...pages(11, 2, at(2026, 9, 15))];
    expect(wirdStreak(readings, 5, now)).toBe(2);
    expect(wirdStreak([...readings, ...pages(13, 3, at(2026, 9, 15, 21))], 5, now)).toBe(3);
  });

  it('breaks the streak on a missed day', () => {
    const readings = [...pages(1, 5, at(2026, 9, 12)), ...pages(6, 5, at(2026, 9, 14))];
    expect(wirdStreak(readings, 5, now)).toBe(1);
  });

  it('estimates days to finish at the wird pace', () => {
    expect(daysAtWird(555, 5)).toBe(111);
    expect(daysAtWird(0, 5)).toBe(1);
  });
});
