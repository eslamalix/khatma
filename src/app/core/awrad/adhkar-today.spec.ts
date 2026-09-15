import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { adhkarDayKey, adhkarPeriodAt, AdhkarToday } from './adhkar-today';

describe('Adhkar Timing and Day Cycles', () => {
  describe('adhkarDayKey', () => {
    it('treats hours before 04:00 AM as belonging to the previous calendar day', () => {
      // 2026-09-16 at 01:30 AM -> belongs to 2026-09-15
      const night = new Date(2026, 8, 16, 1, 30);
      expect(adhkarDayKey(night)).toBe('2026-09-15');

      // 2026-09-16 at 03:59 AM -> belongs to 2026-09-15
      const lateNight = new Date(2026, 8, 16, 3, 59);
      expect(adhkarDayKey(lateNight)).toBe('2026-09-15');
    });

    it('treats hours from 04:00 AM onward as the current day', () => {
      // 2026-09-16 at 04:00 AM -> belongs to 2026-09-16
      const fajr = new Date(2026, 8, 16, 4, 0);
      expect(adhkarDayKey(fajr)).toBe('2026-09-16');

      // 2026-09-16 at 12:00 PM -> belongs to 2026-09-16
      const noon = new Date(2026, 8, 16, 12, 0);
      expect(adhkarDayKey(noon)).toBe('2026-09-16');

      // 2026-09-16 at 23:59 PM -> belongs to 2026-09-16
      const nightBeforeMidnight = new Date(2026, 8, 16, 23, 59);
      expect(adhkarDayKey(nightBeforeMidnight)).toBe('2026-09-16');
    });
  });

  describe('adhkarPeriodAt', () => {
    it('returns morning for 04:00 AM to 11:59 AM', () => {
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 4, 0))).toBe('morning');
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 8, 30))).toBe('morning');
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 11, 59))).toBe('morning');
    });

    it('returns null during noon between 12:00 PM and 02:59 PM', () => {
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 12, 0))).toBeNull();
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 14, 59))).toBeNull();
    });

    it('returns evening from 03:00 PM through midnight until 03:59 AM', () => {
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 15, 0))).toBe('evening');
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 20, 0))).toBe('evening');
      expect(adhkarPeriodAt(new Date(2026, 8, 16, 23, 59))).toBe('evening');
      expect(adhkarPeriodAt(new Date(2026, 8, 17, 0, 1))).toBe('evening');
      expect(adhkarPeriodAt(new Date(2026, 8, 17, 2, 30))).toBe('evening');
      expect(adhkarPeriodAt(new Date(2026, 8, 17, 3, 59))).toBe('evening');
    });
  });

  describe('AdhkarToday store persistence & rollover', () => {
    beforeEach(() => {
      localStorage.clear();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('initializes empty when storage is clear', () => {
      const store = new AdhkarToday();
      expect(store.doneToday().size).toBe(0);
      expect(Object.keys(store.countsToday()).length).toBe(0);
      expect(store.isDone('morning')).toBe(false);
    });

    it('marks category done and saves counts', () => {
      vi.setSystemTime(new Date(2026, 8, 16, 6, 0)); // 6 AM
      const store = new AdhkarToday();

      store.markDone('morning');
      store.saveCounts({ 'm-1': 1, 'm-2': 1 });

      expect(store.isDone('morning')).toBe(true);
      expect(store.countsToday()['m-1']).toBe(1);

      // Re-instantiating on the same cycle loads the saved state
      const reloaded = new AdhkarToday();
      expect(reloaded.isDone('morning')).toBe(true);
      expect(reloaded.countsToday()['m-1']).toBe(1);
    });

    it('preserves evening adhkar across midnight into the early hours before 04:00 AM', () => {
      // Completed evening adhkar at 11:30 PM on Sept 16
      vi.setSystemTime(new Date(2026, 8, 16, 23, 30));
      const store = new AdhkarToday();
      store.markDone('evening');
      expect(store.isDone('evening')).toBe(true);

      // Advance time to 01:30 AM on Sept 17 (calendar day changed, but adhkar day is still Sept 16)
      vi.setSystemTime(new Date(2026, 8, 17, 1, 30));
      const nextMorningEarly = new AdhkarToday();
      expect(nextMorningEarly.isDone('evening')).toBe(true);
      expect(nextMorningEarly.periodNow()).toBe('evening');
    });

    it('resets at 04:00 AM for the new day cycle', () => {
      // Completed on Sept 16
      vi.setSystemTime(new Date(2026, 8, 16, 18, 0));
      const store = new AdhkarToday();
      store.markDone('morning');
      store.markDone('evening');
      store.saveCounts({ 'm-1': 1, 'e-1': 1 });

      // Advance time to 04:05 AM on Sept 17 (new cycle begins)
      vi.setSystemTime(new Date(2026, 8, 17, 4, 5));
      const storeNewDay = new AdhkarToday();
      expect(storeNewDay.isDone('morning')).toBe(false);
      expect(storeNewDay.isDone('evening')).toBe(false);
      expect(Object.keys(storeNewDay.countsToday()).length).toBe(0);
      expect(storeNewDay.periodNow()).toBe('morning');
    });

    it('refreshes signals when rollover occurs without page reload', () => {
      vi.setSystemTime(new Date(2026, 8, 16, 3, 50)); // 3:50 AM (previous day cycle)
      const store = new AdhkarToday();
      store.markDone('evening');
      expect(store.isDone('evening')).toBe(true);
      expect(store.periodNow()).toBe('evening');

      // Time crosses into 4:05 AM
      vi.setSystemTime(new Date(2026, 8, 16, 4, 5));
      store.refresh();

      expect(store.periodNow()).toBe('morning');
      expect(store.isDone('evening')).toBe(false);
    });
  });
});
