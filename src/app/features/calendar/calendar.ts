import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReadingStore } from '../../core/reading/reading.store';
import {
  AR_WEEKDAYS_SHORT,
  buildDaysMap,
  DaySummary,
  getDayData,
  getMonthData,
  getWeekData,
  toDateStr,
} from '../../core/calendar/calendar-data';
import { ar, dayMonth, timeOfDay } from '../../core/format';
import { surahAtPage, surahName } from '../../core/quran/quran-meta';
import { Icon } from '../../ui/icon';

type CalendarView = 'month' | 'week' | 'day';

@Component({
  selector: 'app-calendar',
  imports: [Icon],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Calendar {
  protected readonly store = inject(ReadingStore);
  protected readonly ar = ar;

  // View mode for mobile (month | week | day)
  readonly viewMode = signal<CalendarView>('month');

  // Currently selected date
  readonly selectedDate = signal<Date>(new Date());

  // Currently viewed month
  readonly currentMonth = signal<{ year: number; month: number }>({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  protected readonly todayStr = toDateStr(new Date());
  protected readonly selectedDateStr = computed(() => toDateStr(this.selectedDate()));

  protected readonly daysMap = computed(() => buildDaysMap(this.store.readings()));

  protected readonly monthData = computed(() =>
    getMonthData(this.currentMonth().year, this.currentMonth().month, this.daysMap())
  );

  protected readonly weekData = computed(() =>
    getWeekData(this.selectedDate(), this.daysMap(), this.todayStr, this.selectedDateStr())
  );

  protected readonly dayData = computed(() => getDayData(this.selectedDate(), this.daysMap()));

  protected readonly weekdayHeaders = AR_WEEKDAYS_SHORT;

  protected readonly lastPosition = computed(() => {
    const s = this.store.state();
    if (!s.lastPage) return null;
    const surah = surahName(surahAtPage(s.lastPage));
    let timeStr = '';
    if (s.lastReadAt) {
      const d = new Date(s.lastReadAt);
      const isToday = toDateStr(d) === this.todayStr;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = toDateStr(d) === toDateStr(yesterday);
      const prefix = isToday ? 'اليوم' : isYesterday ? 'أمس' : dayMonth(s.lastReadAt);
      timeStr = `${prefix} ${timeOfDay(s.lastReadAt)}`;
    }
    return {
      page: ar(s.lastPage),
      surah,
      timeStr,
    };
  });

  setView(mode: CalendarView) {
    this.viewMode.set(mode);
  }

  selectDay(day: DaySummary | null) {
    if (!day) return;
    this.selectedDate.set(new Date(day.date));
  }

  selectDateStr(dateStr: string) {
    const [y, m, d] = dateStr.split('-').map(Number);
    this.selectedDate.set(new Date(y, m - 1, d));
  }

  prevPeriod() {
    const mode = this.viewMode();
    if (mode === 'month') {
      const cur = this.currentMonth();
      let month = cur.month - 1;
      let year = cur.year;
      if (month < 0) {
        month = 11;
        year--;
      }
      this.currentMonth.set({ year, month });
    } else if (mode === 'week') {
      const d = new Date(this.selectedDate());
      d.setDate(d.getDate() - 7);
      this.selectedDate.set(d);
      this.currentMonth.set({ year: d.getFullYear(), month: d.getMonth() });
    } else {
      const d = new Date(this.selectedDate());
      d.setDate(d.getDate() - 1);
      this.selectedDate.set(d);
      this.currentMonth.set({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  nextPeriod() {
    const mode = this.viewMode();
    if (mode === 'month') {
      const cur = this.currentMonth();
      let month = cur.month + 1;
      let year = cur.year;
      if (month > 11) {
        month = 0;
        year++;
      }
      this.currentMonth.set({ year, month });
    } else if (mode === 'week') {
      const d = new Date(this.selectedDate());
      d.setDate(d.getDate() + 7);
      this.selectedDate.set(d);
      this.currentMonth.set({ year: d.getFullYear(), month: d.getMonth() });
    } else {
      const d = new Date(this.selectedDate());
      d.setDate(d.getDate() + 1);
      this.selectedDate.set(d);
      this.currentMonth.set({ year: d.getFullYear(), month: d.getMonth() });
    }
  }

  prevMonth() {
    const cur = this.currentMonth();
    let month = cur.month - 1;
    let year = cur.year;
    if (month < 0) {
      month = 11;
      year--;
    }
    this.currentMonth.set({ year, month });
  }

  nextMonth() {
    const cur = this.currentMonth();
    let month = cur.month + 1;
    let year = cur.year;
    if (month > 11) {
      month = 0;
      year++;
    }
    this.currentMonth.set({ year, month });
  }
}
