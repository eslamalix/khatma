import { juzAtPage } from '../quran/quran-meta';

/** Colours a theme can take; each maps to a `--t-<name>` token that has light and dark values. */
export const THEME_COLORS = [
  'green',
  'red',
  'blue',
  'gold',
  'purple',
  'teal',
  'rose',
  'slate',
] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

/** A subject the reader looks for while reflecting: "آيات الرحمة", "آيات العذاب", ... */
export interface TadabburTheme {
  id: string;
  name: string;
  color: ThemeColor;
  updatedAt: number;
}

/** One ayah (or a run of ayahs in one surah) the reader marked, with their own reflection on it. */
export interface Reflection {
  id: string;
  surah: number;
  from: number;
  to: number;
  /** Mushaf page of the first ayah, to open it again. */
  page: number;
  /** The ayahs themselves (joined with ۝), so the journal works offline and on a new device. */
  text: string;
  themes: string[];
  note: string;
  createdAt: number;
  updatedAt: number;
}

export type ReflectionDraft = Pick<Reflection, 'surah' | 'from' | 'to' | 'page' | 'text'>;

export interface TadabburData {
  themes: TadabburTheme[];
  reflections: Reflection[];
  /** Ids of deleted themes and reflections, with when they were deleted. */
  removed: Record<string, number>;
}

/** Starter themes: the two the owner asked for first, then the subjects people most often trace. */
export const DEFAULT_THEMES: readonly TadabburTheme[] = [
  { id: 'mercy', name: 'الرحمة', color: 'green', updatedAt: 0 },
  { id: 'warning', name: 'العذاب', color: 'red', updatedAt: 0 },
  { id: 'dua', name: 'الدعاء', color: 'blue', updatedAt: 0 },
  { id: 'names', name: 'صفات الله', color: 'gold', updatedAt: 0 },
  { id: 'stories', name: 'القصص والعبر', color: 'purple', updatedAt: 0 },
];

/** Questions that open a reflection when the page is blank (tapping one starts the note with it). */
export const REFLECTION_PROMPTS: readonly string[] = [
  'ماذا تعلّمني عن الله؟',
  'ما الذي أعمل به اليوم؟',
  'أين أنا من هذه الآية؟',
  'بماذا أدعو بعدها؟',
];

export const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

export const covers = (r: Pick<Reflection, 'surah' | 'from' | 'to'>, surah: number, ayah: number) =>
  r.surah === surah && ayah >= r.from && ayah <= r.to;

export const isEmptyReflection = (r: Reflection) => !r.themes.length && !r.note.trim();

/** What an ayah on the page shows: the colour of its first (known) theme, and which reflection to open. */
export interface AyahMark {
  reflectionId: string;
  color: ThemeColor | null;
  hasNote: boolean;
}

/**
 * Ayah → mark, for painting the page. Where reflections overlap the narrowest one wins, so a single ayah
 * marked inside a longer passage stays reachable.
 */
export function buildMarks(
  reflections: readonly Reflection[],
  themes: readonly TadabburTheme[],
): Map<string, AyahMark> {
  const colorOf = new Map(themes.map((t) => [t.id, t.color]));
  const marks = new Map<string, AyahMark>();
  const span = new Map<string, number>();
  for (const r of reflections) {
    const themeId = r.themes.find((id) => colorOf.has(id));
    const mark: AyahMark = {
      reflectionId: r.id,
      color: themeId ? colorOf.get(themeId)! : null,
      hasNote: !!r.note.trim(),
    };
    const width = r.to - r.from;
    for (let a = r.from; a <= r.to; a++) {
      const key = ayahKey(r.surah, a);
      if ((span.get(key) ?? Infinity) <= width) continue;
      marks.set(key, mark);
      span.set(key, width);
    }
  }
  return marks;
}

/** The reflection the reader means by tapping this ayah: the narrowest one covering it. */
export function reflectionAt(
  reflections: readonly Reflection[],
  surah: number,
  ayah: number,
): Reflection | null {
  let best: Reflection | null = null;
  for (const r of reflections) {
    if (covers(r, surah, ayah) && (!best || r.to - r.from < best.to - best.from)) best = r;
  }
  return best;
}

/**
 * Arabic text reduced for matching: no diacritics, Quranic marks or tatweel, and one form of alef, ya and
 * ta marbuta. "رحمة" then finds "رَحۡمَةٗ" and "ٱلرَّحۡمَةِ".
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱأإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export type JournalSort = 'mushaf' | 'recent';

/** The journal list: one theme or all, a free-text search over the ayahs, the note and the surah name. */
export function filterReflections(
  reflections: readonly Reflection[],
  opts: {
    theme: string | null;
    query: string;
    sort: JournalSort;
    surahName: (n: number) => string;
  },
): Reflection[] {
  const q = normalizeArabic(opts.query);
  const list = reflections.filter((r) => {
    if (opts.theme && !r.themes.includes(opts.theme)) return false;
    if (!q) return true;
    return normalizeArabic(`${r.text} ${r.note} ${opts.surahName(r.surah)}`).includes(q);
  });
  return list.sort((a, b) =>
    opts.sort === 'recent'
      ? b.createdAt - a.createdAt
      : a.surah - b.surah || a.from - b.from || a.to - b.to,
  );
}

/** How many reflections fall in each of the 30 juz: where in the mushaf a theme lives. */
export function juzSpread(reflections: readonly Reflection[]): number[] {
  const counts = new Array<number>(30).fill(0);
  for (const r of reflections) counts[juzAtPage(r.page) - 1]++;
  return counts;
}

/** Plain text for sharing a list of ayahs with their references and notes. */
export function reflectionsAsText(
  reflections: readonly Reflection[],
  surahName: (n: number) => string,
  digits: (n: number) => string,
) {
  return reflections
    .map((r) => {
      const ref = r.from === r.to ? digits(r.from) : `${digits(r.from)}-${digits(r.to)}`;
      const ayahs = `﴿${r.text.replace(/ ۝ /g, ' ')}﴾ [${surahName(r.surah)}: ${ref}]`;
      return r.note.trim() ? `${ayahs}\n${r.note.trim()}` : ayahs;
    })
    .join('\n\n');
}

export interface TadabburMerge {
  data: TadabburData;
  /** The cloud copy had something this device did not. */
  changed: boolean;
  /** The cloud copy still holds something deleted here, or an older version, so it has to be rewritten. */
  cleanup: boolean;
}

/**
 * Brings the cloud copy together with this device's. Items are matched by id and the newer edit wins, so
 * a note written on the phone and a theme added on the laptop both survive; a deletion only holds when
 * it is recorded as a tombstone, otherwise the other device would hand the item straight back.
 */
export function mergeTadabbur(local: TadabburData, cloud: Partial<TadabburData>): TadabburMerge {
  const removed: Record<string, number> = { ...(cloud.removed ?? {}) };
  for (const [id, at] of Object.entries(local.removed))
    removed[id] = Math.max(removed[id] ?? 0, at);

  let changed = false;
  let cleanup = false;

  const mergeList = <T extends { id: string; updatedAt: number }>(
    mine: readonly T[],
    theirs: readonly T[] | undefined,
  ) => {
    const out = new Map<string, T>();
    for (const item of mine) if (!removed[item.id]) out.set(item.id, item);
    const theirIds = new Set<string>();
    for (const item of theirs ?? []) {
      theirIds.add(item.id);
      if (removed[item.id]) {
        cleanup = true;
        continue;
      }
      const have = out.get(item.id);
      if (!have || item.updatedAt > have.updatedAt) {
        out.set(item.id, item);
        changed = true;
      } else if (have.updatedAt > item.updatedAt) {
        cleanup = true;
      }
    }
    for (const item of mine) if (!removed[item.id] && !theirIds.has(item.id)) cleanup = true;
    return [...out.values()];
  };

  const themes = mergeList(local.themes, cloud.themes);
  const reflections = mergeList(local.reflections, cloud.reflections);
  // Something deleted on the other device while it was still here.
  if ([...local.themes, ...local.reflections].some((item) => removed[item.id])) changed = true;
  return { data: { themes, reflections, removed }, changed, cleanup };
}

/** Deletions older than the window cannot still be in flight between devices. */
export function pruneRemoved(
  removed: Record<string, number>,
  now = Date.now(),
  ttlMs = 180 * 24 * 60 * 60 * 1000,
) {
  return Object.fromEntries(Object.entries(removed).filter(([, at]) => at > now - ttlMs));
}
