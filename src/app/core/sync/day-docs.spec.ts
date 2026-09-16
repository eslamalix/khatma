import { DEFAULT_STATE, Reading } from '../reading/reading';
import { dayDocOf, dayKeyOf, mergeDay, pendingDays, readingsFromDays, summaryOf } from './day-docs';

const at = (d: number, h = 9) => new Date(2026, 8, d, h).getTime();

const read = (id: string, page: number, day: number, durationMs = 60_000, syncedTo?: string): Reading => ({
  id,
  page,
  khatma: 1,
  startAt: at(day),
  endAt: at(day) + durationMs,
  durationMs,
  synced: syncedTo ? 1 : 0,
  syncedTo,
});

describe('dayDocOf', () => {
  it('rolls a day up into totals and keeps the visits in order', () => {
    const day = dayDocOf('2026-09-14', [read('b', 3, 14, 30_000), read('a', 2, 14, 90_000)], at(14, 20));
    expect(day.visits.map((v) => v.id)).toEqual(['b', 'a']);
    expect(day.pages).toBe(2);
    expect(day.totalMs).toBe(120_000);
    expect(day.lastAt).toBe(at(14) + 90_000);
  });

  it('counts a page read twice in the same day once', () => {
    expect(dayDocOf('2026-09-14', [read('a', 2, 14), read('b', 2, 14)]).pages).toBe(1);
  });

  it('does not store the device sync flags in the cloud', () => {
    const [visit] = dayDocOf('2026-09-14', [read('a', 2, 14, 60_000, 'eslam')]).visits;
    expect(Object.keys(visit).sort()).toEqual(['durationMs', 'endAt', 'id', 'khatma', 'page', 'startAt']);
  });
});

describe('pendingDays', () => {
  it('names only the days holding readings this account has not received', () => {
    const readings = [read('a', 1, 14, 60_000, 'eslam'), read('b', 2, 15), read('c', 3, 15)];
    expect(pendingDays(readings, 'eslam')).toEqual([dayKeyOf(read('b', 2, 15))]);
  });

  it('treats a day synced to a previous account as pending', () => {
    expect(pendingDays([read('a', 1, 14, 60_000, 'first')], 'second')).toHaveLength(1);
  });
});

describe('mergeDay', () => {
  it('keeps visits both phones recorded on the same day', () => {
    const mine = dayDocOf('2026-09-14', [read('a', 1, 14)]);
    const theirs = dayDocOf('2026-09-14', [read('b', 2, 14)]);
    const merged = mergeDay(mine, theirs);
    expect(merged.visits.map((v) => v.id).sort()).toEqual(['a', 'b']);
    expect(merged.pages).toBe(2);
    expect(merged.totalMs).toBe(120_000);
  });

  it('keeps the longer record of the same visit', () => {
    const mine = dayDocOf('2026-09-14', [read('a', 1, 14, 30_000)]);
    const theirs = dayDocOf('2026-09-14', [read('a', 1, 14, 200_000)]);
    expect(mergeDay(mine, theirs).totalMs).toBe(200_000);
    expect(mergeDay(theirs, mine).totalMs).toBe(200_000);
  });

  it('leaves the day alone when the account has nothing for it', () => {
    const mine = dayDocOf('2026-09-14', [read('a', 1, 14)]);
    expect(mergeDay(mine, undefined)).toEqual(mine);
  });
});

describe('readingsFromDays', () => {
  it('rebuilds the flat list tagged as already stored', () => {
    const days = [dayDocOf('2026-09-15', [read('b', 2, 15)]), dayDocOf('2026-09-14', [read('a', 1, 14)])];
    const readings = readingsFromDays(days, 'eslam');
    expect(readings.map((r) => r.id)).toEqual(['a', 'b']);
    expect(readings.every((r) => r.syncedTo === 'eslam')).toBe(true);
  });
});

describe('summaryOf', () => {
  it('totals what an owner dashboard lists for one reader', () => {
    const readings = [read('a', 1, 14), read('b', 2, 14), read('c', 3, 15)];
    const summary = summaryOf(
      readings,
      { ...DEFAULT_STATE, currentKhatma: 1, lastPage: 3, lastReadAt: at(15) },
      { name: 'إسلام', email: 'x@example.com', anonymous: false },
      '0.0.13',
      at(15, 21),
    );
    expect(summary.visits).toBe(3);
    expect(summary.readingDays).toBe(2);
    expect(summary.totalMs).toBe(180_000);
    expect(summary.pagesThisKhatma).toBe(3);
    expect(summary.firstReadAt).toBe(at(14));
    expect(summary.anonymous).toBe(false);
  });

  it('reports an empty account without inventing a first reading', () => {
    const summary = summaryOf([], DEFAULT_STATE, { name: null, email: null, anonymous: true }, '0.0.13');
    expect(summary.firstReadAt).toBeNull();
    expect(summary.visits).toBe(0);
    expect(summary.readingDays).toBe(0);
  });
});
