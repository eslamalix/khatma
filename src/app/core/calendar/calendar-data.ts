import { Reading } from '../reading/reading';
import { ar, counted, DAYS, MINUTES, PAGES } from '../format';
import { surahAtPage, surahName } from '../quran/quran-meta';

export interface ReadingSession {
  startAt: number;
  endAt: number;
  durationMs: number;
  pages: number[];
  startPage: number;
  endPage: number;
  surahSummary: string;
  timeRange: string;
  durationStr: string;
  startHour: number; // 0..24
  endHour: number; // 0..24
  arcPath: string;
}

export interface DaySummary {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayOfWeek: number; // 0 (Sun) .. 6 (Sat)
  totalMs: number;
  totalMinutes: number;
  pagesCount: number;
  sessions: ReadingSession[];
  intensity: 0 | 1 | 2 | 3 | 4;
}

export interface MonthData {
  year: number;
  month: number; // 0..11
  title: string; // e.g. "سبتمبر ٢٠٢٦"
  hijriTitle: string; // e.g. "ربيع الأول ١٤٤٨"
  totalMs: number;
  totalPages: number;
  summaryStr: string; // e.g. "٥ س ٤٠ د، ٣١٨ صفحة"
  days: (DaySummary | null)[]; // Leading nulls for alignment on Sunday
}

export interface WeekBar {
  dayName: string; // "أحد", "إثنين", etc.
  dayNum: string; // "٦", "٧", etc.
  dateStr: string;
  minutes: number;
  minutesStr: string;
  pagesCount: number;
  heightPx: number;
  isToday: boolean;
  isSelected: boolean;
  isBest: boolean;
}

export interface WeekData {
  startDate: Date;
  endDate: Date;
  title: string; // e.g. "٦ – ١٢ سبتمبر"
  hijriTitle: string;
  totalMs: number;
  totalPages: number;
  summaryStr: string; // e.g. "٣ س ١٦ د، ١٨٤ صفحة"
  bars: WeekBar[];
  bestDay: { name: string; minutes: number; pages: number } | null;
  dailyAvgMinutes: number;
  dailyAvgPages: number;
}

export interface DayData {
  date: Date;
  dateStr: string;
  title: string; // e.g. "الأحد ١٣ سبتمبر"
  hijriTitle: string;
  sessionCountStr: string; // e.g. "٣ جلسات"
  totalMinutes: number;
  totalPages: number;
  sessions: ReadingSession[];
  clockTicks: { x1: number; y1: number; x2: number; y2: number }[];
}

/** Format YYYY-MM-DD using local time */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD to Date at midnight local time */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export const AR_WEEKDAYS_SHORT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
export const AR_WEEKDAYS_NAMES = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const AR_WEEKDAYS_COMPACT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const timeFmt = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' });

/** "٩:١٤ م" + "٩:١٨ م" → "٩:١٤ – ٩:١٨ م" */
export function compactRange(start: string, end: string): string {
  const [sTime, sPeriod] = start.split(' ');
  const [eTime, ePeriod] = end.split(' ');
  return sPeriod === ePeriod && sPeriod
    ? `${sTime} – ${eTime} ${ePeriod}`.trim()
    : `${start} – ${end}`;
}

export function formatTimeRange(startAt: number, endAt: number): string {
  return compactRange(timeFmt.format(startAt), timeFmt.format(endAt));
}

/** Group raw readings into continuous sessions (gap <= 15 min). */
export function groupSessions(readings: readonly Reading[]): ReadingSession[] {
  if (!readings.length) return [];
  const sorted = [...readings].sort((a, b) => a.startAt - b.startAt);
  const rawSessions: Reading[][] = [];
  let currentGroup: Reading[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    // Gap of more than 15 minutes between previous end and current start creates a new session
    if (curr.startAt - prev.endAt > 15 * 60 * 1000) {
      rawSessions.push(currentGroup);
      currentGroup = [curr];
    } else {
      currentGroup.push(curr);
    }
  }
  rawSessions.push(currentGroup);

  return rawSessions.map((group) => {
    const startAt = group[0].startAt;
    const endAt = group[group.length - 1].endAt;
    const durationMs = group.reduce((sum, r) => sum + r.durationMs, 0);
    const pages = Array.from(new Set(group.map((r) => r.page))).sort((a, b) => a - b);
    const startPage = pages[0];
    const endPage = pages[pages.length - 1];

    // Surah names spanned
    const surahIndices = Array.from(new Set(pages.map((p) => surahAtPage(p))));
    const surahSummary = surahIndices.map((s) => surahName(s)).join('، ');

    const sDate = new Date(startAt);
    const eDate = new Date(endAt);
    const startHour = sDate.getHours() + sDate.getMinutes() / 60 + sDate.getSeconds() / 3600;
    let endHour = eDate.getHours() + eDate.getMinutes() / 60 + eDate.getSeconds() / 3600;
    if (endHour <= startHour) endHour = startHour + Math.max(0.1, durationMs / 3_600_000);

    const arcPath = computeClockArc(startHour, endHour);

    const min = Math.max(1, Math.round(durationMs / 60_000));

    return {
      startAt,
      endAt,
      durationMs,
      pages,
      startPage,
      endPage,
      surahSummary,
      timeRange: formatTimeRange(startAt, endAt),
      durationStr: ar(`${min} د`),
      startHour,
      endHour,
      arcPath,
    };
  });
}

/** 24-hour circular dial: R=108, center=(160, 160), 0h=top (angle=-PI/2), clockwise. */
export function computeClockArc(startHour: number, endHour: number): string {
  const cx = 160;
  const cy = 160;
  const r = 108;

  // Minimum arc to be visually noticeable (at least ~8 minutes / 0.13h)
  const span = Math.max(0.13, Math.min(24, endHour - startHour));
  const effectiveEndHour = startHour + span;

  const a1 = (startHour / 24) * 2 * Math.PI - Math.PI / 2;
  const a2 = (effectiveEndHour / 24) * 2 * Math.PI - Math.PI / 2;

  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);

  const largeArc = span > 12 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/** Generate the 20 dial tick marks (excluding 0, 6, 12, 18). */
export function getClockTicks(): { x1: number; y1: number; x2: number; y2: number }[] {
  const cx = 160;
  const cy = 160;
  const r1 = 124;
  const r2 = 131;
  const ticks: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let h = 0; h < 24; h++) {
    // Skip 4 cardinal positions where labels 12ص, 6ص, 12م, 6م sit
    if (h === 0 || h === 6 || h === 12 || h === 18) continue;
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    ticks.push({
      x1: +(cx + r1 * Math.cos(a)).toFixed(1),
      y1: +(cy + r1 * Math.sin(a)).toFixed(1),
      x2: +(cx + r2 * Math.cos(a)).toFixed(1),
      y2: +(cy + r2 * Math.sin(a)).toFixed(1),
    });
  }
  return ticks;
}

export function computeIntensity(totalMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (totalMinutes <= 0) return 0;
  if (totalMinutes <= 15) return 1;
  if (totalMinutes <= 30) return 2;
  if (totalMinutes <= 60) return 3;
  return 4;
}

/** Format Hijri date concisely */
export function formatHijri(date: Date, options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }): string {
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', options);
    return fmt.format(date);
  } catch {
    return '';
  }
}

/** Group all readings into daily summaries */
export function buildDaysMap(readings: readonly Reading[]): Map<string, DaySummary> {
  const grouped = new Map<string, Reading[]>();
  for (const r of readings) {
    const dStr = toDateStr(new Date(r.startAt));
    const list = grouped.get(dStr);
    if (list) list.push(r);
    else grouped.set(dStr, [r]);
  }

  const map = new Map<string, DaySummary>();
  for (const [dStr, list] of grouped.entries()) {
    const date = fromDateStr(dStr);
    const sessions = groupSessions(list);
    const totalMs = list.reduce((sum, r) => sum + r.durationMs, 0);
    const totalMinutes = Math.round(totalMs / 60_000);
    const uniquePages = new Set(list.map((r) => r.page));
    map.set(dStr, {
      date,
      dateStr: dStr,
      dayOfMonth: date.getDate(),
      dayOfWeek: date.getDay(),
      totalMs,
      totalMinutes,
      pagesCount: uniquePages.size,
      sessions,
      intensity: computeIntensity(totalMinutes),
    });
  }
  return map;
}

/** Build data for a specific Month */
export function getMonthData(year: number, month: number, daysMap: Map<string, DaySummary>): MonthData {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const numDays = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sun

  const days: (DaySummary | null)[] = [];
  // Leading empty cells
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }

  let totalMs = 0;
  let totalPages = 0;

  for (let d = 1; d <= numDays; d++) {
    const currDate = new Date(year, month, d);
    const dStr = toDateStr(currDate);
    const existing = daysMap.get(dStr);
    if (existing) {
      days.push(existing);
      totalMs += existing.totalMs;
      totalPages += existing.pagesCount;
    } else {
      days.push({
        date: currDate,
        dateStr: dStr,
        dayOfMonth: d,
        dayOfWeek: currDate.getDay(),
        totalMs: 0,
        totalMinutes: 0,
        pagesCount: 0,
        sessions: [],
        intensity: 0,
      });
    }
  }

  const title = `${AR_MONTHS[month]} ${ar(year)}`;
  const hijriTitle = formatHijri(firstDay, { month: 'long', year: 'numeric' });

  const totalMin = Math.round(totalMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const timeStr = h > 0 ? `${ar(h)} س ${ar(m)} د` : `${ar(m)} د`;
  const summaryStr = totalMs > 0
    ? `${timeStr}، ${ar(totalPages)} ${counted(totalPages, PAGES)}`
    : 'لم تقرأ بعد هذا الشهر';

  return {
    year,
    month,
    title,
    hijriTitle,
    totalMs,
    totalPages,
    summaryStr,
    days,
  };
}

/** Build data for the week containing `selectedDate` (week starts on Sunday). */
export function getWeekData(
  selectedDate: Date,
  daysMap: Map<string, DaySummary>,
  todayStr: string,
  selectedStr: string
): WeekData {
  const d = new Date(selectedDate);
  const dayOfWeek = d.getDay(); // 0 = Sun
  const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek);
  const saturday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 6);

  let totalMs = 0;
  let totalPages = 0;
  const weekDays: DaySummary[] = [];

  for (let i = 0; i < 7; i++) {
    const curr = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
    const dStr = toDateStr(curr);
    const existing = daysMap.get(dStr) ?? {
      date: curr,
      dateStr: dStr,
      dayOfMonth: curr.getDate(),
      dayOfWeek: i,
      totalMs: 0,
      totalMinutes: 0,
      pagesCount: 0,
      sessions: [],
      intensity: 0 as const,
    };
    weekDays.push(existing);
    totalMs += existing.totalMs;
    totalPages += existing.pagesCount;
  }

  // Find max minutes for scaling chart bars
  const maxMinutes = Math.max(30, ...weekDays.map((w) => w.totalMinutes));
  const chartHeightPx = 200;

  let bestDayObj: { name: string; minutes: number; pages: number } | null = null;
  let maxDayMs = 0;

  const bars: WeekBar[] = weekDays.map((w) => {
    if (w.totalMs > maxDayMs && w.totalMinutes > 0) {
      maxDayMs = w.totalMs;
      bestDayObj = {
        name: AR_WEEKDAYS_NAMES[w.dayOfWeek],
        minutes: w.totalMinutes,
        pages: w.pagesCount,
      };
    }

    const heightPx = w.totalMinutes > 0
      ? Math.max(14, Math.round((w.totalMinutes / maxMinutes) * chartHeightPx))
      : 6;

    return {
      dayName: AR_WEEKDAYS_COMPACT[w.dayOfWeek],
      dayNum: ar(w.dayOfMonth),
      dateStr: w.dateStr,
      minutes: w.totalMinutes,
      minutesStr: ar(w.totalMinutes),
      pagesCount: w.pagesCount,
      heightPx,
      isToday: w.dateStr === todayStr,
      isSelected: w.dateStr === selectedStr,
      isBest: false,
    };
  });

  if (bestDayObj) {
    const bestName = (bestDayObj as { name: string }).name;
    for (let i = 0; i < bars.length; i++) {
      if (AR_WEEKDAYS_NAMES[weekDays[i].dayOfWeek] === bestName && weekDays[i].totalMinutes > 0) {
        bars[i].isBest = true;
      }
    }
  }

  // Format title: e.g. "٦ – ١٢ سبتمبر"
  const startDayNum = ar(sunday.getDate());
  const endDayNum = ar(saturday.getDate());
  const monthName = AR_MONTHS[saturday.getMonth()];
  const title = sunday.getMonth() === saturday.getMonth()
    ? `${startDayNum} – ${endDayNum} ${monthName}`
    : `${startDayNum} ${AR_MONTHS[sunday.getMonth()]} – ${endDayNum} ${monthName}`;

  const hijriTitle = `${formatHijri(sunday, { day: 'numeric', month: 'numeric' })} – ${formatHijri(saturday, { day: 'numeric', month: 'numeric', year: 'numeric' })}`;

  const totalMin = Math.round(totalMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const timeStr = h > 0 ? `${ar(h)} س ${ar(m)} د` : `${ar(m)} د`;
  const summaryStr = totalMs > 0
    ? `${timeStr}، ${ar(totalPages)} ${counted(totalPages, PAGES)}`
    : 'لا توجد قراءات في هذا الأسبوع';

  const dailyAvgMinutes = Math.round(totalMin / 7);
  const dailyAvgPages = Math.round(totalPages / 7);

  return {
    startDate: sunday,
    endDate: saturday,
    title,
    hijriTitle,
    totalMs,
    totalPages,
    summaryStr,
    bars,
    bestDay: bestDayObj,
    dailyAvgMinutes,
    dailyAvgPages,
  };
}

/** Build data for a single day */
export function getDayData(selectedDate: Date, daysMap: Map<string, DaySummary>): DayData {
  const dStr = toDateStr(selectedDate);
  const existing = daysMap.get(dStr);
  const weekdayName = AR_WEEKDAYS_NAMES[selectedDate.getDay()];
  const dayNum = ar(selectedDate.getDate());
  const monthName = AR_MONTHS[selectedDate.getMonth()];
  const title = `${weekdayName} ${dayNum} ${monthName}`;
  const hijriTitle = formatHijri(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' });

  const sessions = existing?.sessions ?? [];
  const sessionCount = sessions.length;
  const sessionCountStr = sessionCount === 0
    ? 'لا توجد جلسات'
    : sessionCount === 1
    ? 'جلسة واحدة'
    : sessionCount === 2
    ? 'جلستان'
    : sessionCount <= 10
    ? `${ar(sessionCount)} جلسات`
    : `${ar(sessionCount)} جلسة`;

  return {
    date: selectedDate,
    dateStr: dStr,
    title,
    hijriTitle,
    sessionCountStr,
    totalMinutes: existing?.totalMinutes ?? 0,
    totalPages: existing?.pagesCount ?? 0,
    sessions,
    clockTicks: getClockTicks(),
  };
}
