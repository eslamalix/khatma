/** Madani mushaf (604 pages) metadata. Verified against api.alquran.cloud page data. */

export const TOTAL_PAGES = 604;

export const SURAH_NAMES: readonly string[] = [
  'الفاتحة', 'البقرة', 'آل عمران', 'النساء', 'المائدة', 'الأنعام', 'الأعراف', 'الأنفال', 'التوبة', 'يونس',
  'هود', 'يوسف', 'الرعد', 'إبراهيم', 'الحجر', 'النحل', 'الإسراء', 'الكهف', 'مريم', 'طه',
  'الأنبياء', 'الحج', 'المؤمنون', 'النور', 'الفرقان', 'الشعراء', 'النمل', 'القصص', 'العنكبوت', 'الروم',
  'لقمان', 'السجدة', 'الأحزاب', 'سبأ', 'فاطر', 'يس', 'الصافات', 'ص', 'الزمر', 'غافر',
  'فصلت', 'الشورى', 'الزخرف', 'الدخان', 'الجاثية', 'الأحقاف', 'محمد', 'الفتح', 'الحجرات', 'ق',
  'الذاريات', 'الطور', 'النجم', 'القمر', 'الرحمن', 'الواقعة', 'الحديد', 'المجادلة', 'الحشر', 'الممتحنة',
  'الصف', 'الجمعة', 'المنافقون', 'التغابن', 'الطلاق', 'التحريم', 'الملك', 'القلم', 'الحاقة', 'المعارج',
  'نوح', 'الجن', 'المزمل', 'المدثر', 'القيامة', 'الإنسان', 'المرسلات', 'النبأ', 'النازعات', 'عبس',
  'التكوير', 'الانفطار', 'المطففين', 'الانشقاق', 'البروج', 'الطارق', 'الأعلى', 'الغاشية', 'الفجر', 'البلد',
  'الشمس', 'الليل', 'الضحى', 'الشرح', 'التين', 'العلق', 'القدر', 'البينة', 'الزلزلة', 'العاديات',
  'القارعة', 'التكاثر', 'العصر', 'الهمزة', 'الفيل', 'قريش', 'الماعون', 'الكوثر', 'الكافرون', 'النصر',
  'المسد', 'الإخلاص', 'الفلق', 'الناس',
];

/** First page of each surah (index 0 = surah 1). */
export const SURAH_START_PAGES: readonly number[] = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208, 221, 235, 249, 255, 262, 267, 282, 293, 305, 312,
  322, 332, 342, 350, 359, 367, 377, 385, 396, 404, 411, 415, 418, 428, 434, 440, 446, 453, 458, 467,
  477, 483, 489, 496, 499, 502, 507, 511, 515, 518, 520, 523, 526, 528, 531, 534, 537, 542, 545, 549,
  551, 553, 554, 556, 558, 560, 562, 564, 566, 568, 570, 572, 574, 575, 577, 578, 580, 582, 583, 585,
  586, 587, 587, 589, 590, 591, 591, 592, 593, 594, 595, 595, 596, 596, 597, 597, 598, 598, 599, 599,
  600, 600, 601, 601, 601, 602, 602, 602, 603, 603, 603, 604, 604, 604,
];

/** First page of each juz (index 0 = juz 1). */
export const JUZ_START_PAGES: readonly number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

export const clampPage = (page: number) => Math.min(TOTAL_PAGES, Math.max(1, Math.round(page)));

export const surahName = (surah: number) => SURAH_NAMES[surah - 1] ?? '';

/** The first surah shown on a page (metadata-only approximation; page data is authoritative). */
export function surahAtPage(page: number): number {
  let s = 1;
  for (let i = 0; i < SURAH_START_PAGES.length; i++) if (SURAH_START_PAGES[i] <= page) s = i + 1;
  while (s > 1 && SURAH_START_PAGES[s - 2] === SURAH_START_PAGES[s - 1] && SURAH_START_PAGES[s - 1] === page) s--;
  return s;
}

export function juzAtPage(page: number): number {
  let j = 1;
  for (let i = 0; i < JUZ_START_PAGES.length; i++) if (JUZ_START_PAGES[i] <= page) j = i + 1;
  return j;
}

/** Pages a surah spans. When the next surah starts on a fresh page, this surah ends the page before. */
export function surahPages(surah: number): { from: number; to: number } {
  const from = SURAH_START_PAGES[surah - 1];
  const to = surah < 114 ? Math.max(from, SURAH_START_PAGES[surah] - 1) : TOTAL_PAGES;
  return { from, to };
}

/** Number of ayahs in each surah (Hafs, 6236 in total). */
export const AYAH_COUNTS: readonly number[] = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77,
  227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36,
  25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

export interface AyahRef {
  surah: number;
  ayah: number;
}

/** The ayah after `ref` in mushaf order, crossing into the next surah; null after An-Nas. */
export function nextAyah({ surah, ayah }: AyahRef): AyahRef | null {
  if (ayah < AYAH_COUNTS[surah - 1]) return { surah, ayah: ayah + 1 };
  return surah < 114 ? { surah: surah + 1, ayah: 1 } : null;
}

/** The ayah before `ref` in mushaf order; null before Al-Fatiha 1. */
export function prevAyah({ surah, ayah }: AyahRef): AyahRef | null {
  if (ayah > 1) return { surah, ayah: ayah - 1 };
  return surah > 1 ? { surah: surah - 1, ayah: AYAH_COUNTS[surah - 2] } : null;
}

export const compareAyah = (a: AyahRef, b: AyahRef) => a.surah - b.surah || a.ayah - b.ayah;
