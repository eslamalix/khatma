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

/** One ayah on a card. The text is kept so the journal works offline and on a new device. */
export interface CardAyah {
  surah: number;
  ayah: number;
  /** Mushaf page, to open it again. */
  page: number;
  text: string;
}

/**
 * A tadabbur card: ayahs the reader gathered (in a row or from anywhere in the mushaf), the themes they
 * belong to, and the reader's own words about them.
 */
export interface Reflection {
  id: string;
  title: string;
  ayahs: CardAyah[];
  themes: string[];
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface TadabburData {
  themes: TadabburTheme[];
  reflections: Reflection[];
  /** Ids of deleted themes and cards, with when they were deleted. */
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
  'أين أنا من هذه الآيات؟',
  'بماذا أدعو بعدها؟',
];

export const ayahKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

const byMushaf = (a: CardAyah, b: CardAyah) => a.surah - b.surah || a.ayah - b.ayah;

/** Adds ayahs to a list, keeping mushaf order and each ayah once. */
export function withAyahs(list: readonly CardAyah[], added: readonly CardAyah[]): CardAyah[] {
  const seen = new Set(list.map((a) => ayahKey(a.surah, a.ayah)));
  const out = [...list];
  for (const a of added) {
    const key = ayahKey(a.surah, a.ayah);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out.sort(byMushaf);
}

export const hasAyah = (r: Pick<Reflection, 'ayahs'>, surah: number, ayah: number) =>
  r.ayahs.some((a) => a.surah === surah && a.ayah === ayah);

/** What an ayah on the page shows: the colour of its card's first (known) theme, and which card to open. */
export interface AyahMark {
  reflectionId: string;
  color: ThemeColor | null;
  hasNote: boolean;
}

/**
 * Ayah → mark, for painting the page. An ayah on several cards takes the most recently edited card that
 * has a colour, so the page shows what the reader worked on last.
 */
export function buildMarks(
  reflections: readonly Reflection[],
  themes: readonly TadabburTheme[],
): Map<string, AyahMark> {
  const colorOf = new Map(themes.map((t) => [t.id, t.color]));
  const marks = new Map<string, AyahMark>();
  const ordered = [...reflections].sort((a, b) => a.updatedAt - b.updatedAt);
  for (const r of ordered) {
    const themeId = r.themes.find((id) => colorOf.has(id));
    const mark: AyahMark = {
      reflectionId: r.id,
      color: themeId ? colorOf.get(themeId)! : null,
      hasNote: !!r.note.trim(),
    };
    for (const a of r.ayahs) {
      const key = ayahKey(a.surah, a.ayah);
      if (!mark.color && marks.get(key)?.color) continue;
      marks.set(key, mark);
    }
  }
  return marks;
}

/** "البقرة ٥–٧، ١٢؛ آل عمران ٣": runs of consecutive ayahs joined, surahs apart. */
export function ayahsLabel(
  ayahs: readonly CardAyah[],
  surahName: (n: number) => string,
  digits: (n: number) => string,
  maxSurahs = 3,
): string {
  const groups: { surah: number; runs: [number, number][] }[] = [];
  for (const a of [...ayahs].sort(byMushaf)) {
    let g = groups.at(-1);
    if (g?.surah !== a.surah) groups.push((g = { surah: a.surah, runs: [] }));
    const run = g.runs.at(-1);
    if (run && run[1] === a.ayah - 1) run[1] = a.ayah;
    else g.runs.push([a.ayah, a.ayah]);
  }
  const parts = groups
    .slice(0, maxSurahs)
    .map(
      (g) =>
        `${surahName(g.surah)} ${g.runs
          .map(([from, to]) => (from === to ? digits(from) : `${digits(from)}–${digits(to)}`))
          .join('، ')}`,
    );
  const rest = groups.length - maxSurahs;
  return rest > 0 ? `${parts.join('؛ ')} وغيرها` : parts.join('؛ ');
}

/** A card's name: the title the reader gave it, or where its ayahs are. */
export const cardLabel = (
  r: Pick<Reflection, 'title' | 'ayahs'>,
  surahName: (n: number) => string,
  digits: (n: number) => string,
) => r.title.trim() || ayahsLabel(r.ayahs, surahName, digits) || 'بطاقة تدبّر';

export const isEmptyReflection = (r: Reflection) => !r.ayahs.length;

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

/** The journal list: one theme or all, a free-text search over the title, ayahs, note and surah names. */
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
    const surahs = [...new Set(r.ayahs.map((a) => a.surah))].map(opts.surahName).join(' ');
    const texts = r.ayahs.map((a) => a.text).join(' ');
    return normalizeArabic(`${r.title} ${texts} ${r.note} ${surahs}`).includes(q);
  });
  const first = (r: Reflection) => r.ayahs[0] ?? { surah: 999, ayah: 0 };
  return list.sort((a, b) =>
    opts.sort === 'recent'
      ? b.createdAt - a.createdAt
      : first(a).surah - first(b).surah || first(a).ayah - first(b).ayah,
  );
}

/** Every distinct ayah on these cards. */
export function uniqueAyahs(reflections: readonly Reflection[]): CardAyah[] {
  const map = new Map<string, CardAyah>();
  for (const r of reflections) for (const a of r.ayahs) map.set(ayahKey(a.surah, a.ayah), a);
  return [...map.values()];
}

/** How many distinct ayahs fall in each of the 30 juz: where in the mushaf a theme lives. */
export function juzSpread(reflections: readonly Reflection[]): number[] {
  const counts = new Array<number>(30).fill(0);
  for (const a of uniqueAyahs(reflections)) counts[juzAtPage(a.page) - 1]++;
  return counts;
}

/** Plain text for sharing cards: title, each ayah with its reference, then the note. */
export function reflectionsAsText(
  reflections: readonly Reflection[],
  surahName: (n: number) => string,
  digits: (n: number) => string,
) {
  return reflections
    .map((r) => {
      const lines = r.ayahs.map((a) => `﴿${a.text}﴾ [${surahName(a.surah)}: ${digits(a.ayah)}]`);
      if (r.title.trim()) lines.unshift(`«${r.title.trim()}»`);
      if (r.note.trim()) lines.push(r.note.trim());
      return lines.join('\n');
    })
    .join('\n\n');
}

/** Old single-range entries (`surah`, `from`, `to`, `page`, `text`) become cards holding those ayahs. */
export function upgradeReflection(raw: unknown): Reflection | null {
  const r = raw as Partial<Reflection> & {
    surah?: number;
    from?: number;
    to?: number;
    page?: number;
    text?: string;
  };
  if (!r || typeof r.id !== 'string') return null;
  let ayahs = Array.isArray(r.ayahs) ? r.ayahs : null;
  if (!ayahs && typeof r.surah === 'number' && typeof r.from === 'number') {
    const texts = (r.text ?? '').split(' ۝ ');
    const to = typeof r.to === 'number' ? r.to : r.from;
    ayahs = [];
    for (let n = r.from; n <= to; n++) {
      ayahs.push({ surah: r.surah, ayah: n, page: r.page ?? 1, text: texts[n - r.from] ?? '' });
    }
  }
  return {
    id: r.id,
    title: r.title ?? '',
    ayahs: ayahs ?? [],
    themes: Array.isArray(r.themes) ? r.themes : [],
    note: r.note ?? '',
    createdAt: r.createdAt ?? 0,
    updatedAt: r.updatedAt ?? 0,
  };
}

export const upgradeReflections = (list: unknown[]) =>
  list.map(upgradeReflection).filter((r): r is Reflection => !!r);

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
  const reflections = mergeList(local.reflections, upgradeReflections(cloud.reflections ?? []));
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
