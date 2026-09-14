import { describe, expect, it } from 'vitest';
import {
  buildDaysMap,
  computeClockArc,
  computeIntensity,
  getDayData,
  getMonthData,
  getWeekData,
  groupSessions,
  toDateStr,
} from './calendar-data';
import { Reading } from '../reading/reading';

describe('calendar-data', () => {
  it('formats toDateStr correctly as YYYY-MM-DD', () => {
    const d = new Date(2026, 8, 14); // September 14, 2026
    expect(toDateStr(d)).toBe('2026-09-14');
  });

  it('computes intensity levels accurately based on reading minutes', () => {
    expect(computeIntensity(0)).toBe(0);
    expect(computeIntensity(10)).toBe(1);
    expect(computeIntensity(25)).toBe(2);
    expect(computeIntensity(45)).toBe(3);
    expect(computeIntensity(75)).toBe(4);
  });

  it('groups contiguous readings into a session and separates when gap > 15 min', () => {
    const base = new Date(2026, 8, 14, 10, 0, 0).getTime();
    const readings: Reading[] = [
      { id: '1', page: 1, khatma: 1, startAt: base, endAt: base + 60_000, durationMs: 60_000, synced: 1 },
      // 1 minute later
      { id: '2', page: 2, khatma: 1, startAt: base + 120_000, endAt: base + 180_000, durationMs: 60_000, synced: 1 },
      // 30 minutes later (new session)
      { id: '3', page: 3, khatma: 1, startAt: base + 2_000_000, endAt: base + 2_060_000, durationMs: 60_000, synced: 1 },
    ];

    const sessions = groupSessions(readings);
    expect(sessions.length).toBe(2);
    expect(sessions[0].pages).toEqual([1, 2]);
    expect(sessions[0].durationMs).toBe(120_000);
    expect(sessions[1].pages).toEqual([3]);
  });

  it('calculates 24-hour circular dial arcs with valid SVG path', () => {
    const arc = computeClockArc(6, 7.5);
    expect(arc).toContain('M ');
    expect(arc).toContain('A 108 108 0 0 1');
  });

  it('builds month data with leading nulls matching starting weekday', () => {
    const readings: Reading[] = [];
    const daysMap = buildDaysMap(readings);
    // September 2026: Sept 1st, 2026 is a Tuesday (Sunday=0, Monday=1, Tuesday=2 -> 2 leading nulls)
    const monthData = getMonthData(2026, 8, daysMap);
    expect(monthData.title).toContain('سبتمبر');
    expect(monthData.days[0]).toBeNull();
    expect(monthData.days[1]).toBeNull();
    expect(monthData.days[2]).not.toBeNull();
    expect(monthData.days[2]?.dayOfMonth).toBe(1);
  });

  it('builds week data and identifies the best day', () => {
    const sun = new Date(2026, 8, 6, 12, 0, 0).getTime();
    const fri = new Date(2026, 8, 11, 14, 0, 0).getTime();
    const readings: Reading[] = [
      { id: 'r1', page: 10, khatma: 1, startAt: sun, endAt: sun + 1_200_000, durationMs: 1_200_000, synced: 1 }, // 20 min
      { id: 'r2', page: 11, khatma: 1, startAt: fri, endAt: fri + 3_600_000, durationMs: 3_600_000, synced: 1 }, // 60 min
    ];

    const daysMap = buildDaysMap(readings);
    const weekData = getWeekData(new Date(2026, 8, 8), daysMap, '2026-09-14', '2026-09-08');

    expect(weekData.bars.length).toBe(7);
    expect(weekData.bestDay?.name).toBe('الجمعة');
    expect(weekData.bestDay?.minutes).toBe(60);
  });

  it('builds day data with session summaries', () => {
    const t = new Date(2026, 8, 13, 8, 0, 0).getTime();
    const readings: Reading[] = [
      { id: 'r1', page: 20, khatma: 1, startAt: t, endAt: t + 900_000, durationMs: 900_000, synced: 1 },
    ];
    const daysMap = buildDaysMap(readings);
    const dayData = getDayData(new Date(2026, 8, 13), daysMap);

    expect(dayData.sessions.length).toBe(1);
    expect(dayData.totalMinutes).toBe(15);
    expect(dayData.clockTicks.length).toBe(20);
  });
});
