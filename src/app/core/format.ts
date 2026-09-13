/** Arabic presentation helpers: Arabic-Indic digits, durations and grammatical plurals. */

const DIGITS = '٠١٢٣٤٥٦٧٨٩';

export const ar = (value: number | string): string => String(value).replace(/\d/g, (d) => DIGITS[+d]);

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 38656000 → "١٠:٤٤:١٦" (wrap in dir="ltr" when rendering). */
export function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return ar(`${h}:${pad2(m)}:${pad2(s)}`);
}

/** 64000 → "١:٠٤" */
export function minSec(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  return ar(`${Math.floor(total / 60)}:${pad2(total % 60)}`);
}

type Forms = readonly [one: string, two: string, few: string, many: string];

/** Arabic counted noun: 1 → "دقيقة", 2 → "دقيقتان", 3–10 → "٥ دقائق", 11+ → "٤٤ دقيقة". */
export function counted(n: number, [one, two, few, many]: Forms): string {
  if (n === 1) return one;
  if (n === 2) return two;
  const mod = n % 100;
  return `${ar(n)} ${mod >= 3 && mod <= 10 ? few : many}`;
}

export const HOURS: Forms = ['ساعة', 'ساعتان', 'ساعات', 'ساعة'];
export const MINUTES: Forms = ['دقيقة', 'دقيقتان', 'دقائق', 'دقيقة'];
export const DAYS: Forms = ['يوم', 'يومان', 'أيام', 'يوماً'];
export const PAGES: Forms = ['صفحة', 'صفحتان', 'صفحات', 'صفحة'];

/** 38656000 → { hours: "١٠ ساعات", minutes: "٤٤ دقيقة" } (either part may be empty). */
export function hoursAndMinutes(ms: number): { hours: string; minutes: string } {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { hours: h ? counted(h, HOURS) : '', minutes: m || !h ? counted(m, MINUTES) : '' };
}

/** Compact: "٩ س ٥٢ د", "٥٢ د", "٤٠ ث". */
export function shortDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return ar(`${totalSec} ث`);
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return ar(h ? `${h} س ${m} د` : `${m} د`);
}

export const percent = (ratio: number): string => `${ar(Math.round(ratio * 100))}٪`;

const timeFmt = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' });
const dayMonthFmt = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long' });
const weekdayFmt = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });

export const timeOfDay = (ts: number) => timeFmt.format(ts);
export const dayMonth = (ts: number) => dayMonthFmt.format(ts);
export const weekdayDate = (ts: number) => weekdayFmt.format(ts);

const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة'];

/** Feminine ordinal for "الختمة": 2 → "الثانية". */
export const ordinal = (n: number) => ORDINALS[n - 1] ?? `رقم ${ar(n)}`;
