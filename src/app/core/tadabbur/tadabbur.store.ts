import { computed, Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import {
  addVisitToDays,
  ayahKey,
  buildMarks,
  CardAyah,
  DEFAULT_THEMES,
  hasAyah,
  mergeTadabbur,
  pruneRemoved,
  Reflection,
  TadabburData,
  TadabburTheme,
  ThemeColor,
  THEME_COLORS,
  upgradeReflections,
  tadabburStats,
  withAyahs,
} from './tadabbur';
import { PageVisit } from '../timing/timing-engine';

const DATA_KEY = 'khatma.tadabbur';
const UPDATED_KEY = 'khatma.tadabbur.updated';
/** Where tadabbur reading stopped: its own place in the mushaf, apart from the khatma's. */
const PAGE_KEY = 'khatma.tadabbur.page';
/** Notes are typed a letter at a time; the cloud gets the text once the reader pauses. */
const CLOUD_DEBOUNCE_MS = 3000;

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Tadabbur (docs/DECISIONS.md P20, T30): the reader's themes and cards, each card a set of ayahs with
 * themes and a note. Kept on the device first and mirrored to one Firestore document like the groups.
 * Also holds the ayahs being gathered in the mushaf before they go on a card.
 */
@Injectable({ providedIn: 'root' })
export class TadabburStore {
  private readonly data = signal<TadabburData>(this.load());
  readonly themes = computed(() => this.data().themes);
  readonly reflections = computed(() => this.data().reflections);
  /** Ayah key → what to paint on the page. */
  readonly marks = computed(() => buildMarks(this.reflections(), this.themes()));

  /** Tadabbur reading time and pages: today, this week, all time. */
  readonly stats = computed(() => tadabburStats(this.data().days ?? {}));
  /** The page tadabbur reading stopped on, or null before the first tadabbur reading. */
  readonly lastPage = signal<number | null>(this.loadPage());

  /** The reader is gathering ayahs: a tap on an ayah collects it instead of selecting it. */
  readonly active = signal(false);
  /** Ayahs gathered so far, in mushaf order; they survive page turns until they go on a card. */
  readonly collection = signal<CardAyah[]>([]);
  readonly collectedKeys = computed(
    () => new Set(this.collection().map((a) => ayahKey(a.surah, a.ayah))),
  );
  /** A card the reader chose to add more ayahs to ("إضافة آيات" on the card). */
  readonly targetId = signal<string | null>(null);
  readonly target = computed(() => this.get(this.targetId()));

  private readonly cloud = injectOptional(CloudSync);
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.cloud?.registerDoc<TadabburData>({
      name: 'tadabbur',
      read: () => ({ data: this.data(), updatedAt: this.updatedAt() }),
      apply: (data, updatedAt) => {
        if (!Array.isArray(data.themes) || !Array.isArray(data.reflections)) return;
        this.data.set({
          themes: data.themes,
          reflections: upgradeReflections(data.reflections),
          removed: pruneRemoved(data.removed ?? {}),
          days: data.days ?? {},
        });
        this.saveLocal(updatedAt);
      },
      merge: (cloudData, cloudUpdatedAt) => {
        if (!Array.isArray(cloudData.themes) || !Array.isArray(cloudData.reflections)) return;
        if (this.updatedAt() === cloudUpdatedAt) return;
        const { data, changed, cleanup } = mergeTadabbur(this.data(), cloudData);
        this.data.set({ ...data, removed: pruneRemoved(data.removed) });
        if (changed || cleanup || cloudUpdatedAt > this.updatedAt()) this.save();
        else this.saveLocal(this.updatedAt());
      },
      reset: () => {
        try {
          localStorage.removeItem(DATA_KEY);
          localStorage.removeItem(UPDATED_KEY);
        } catch {
          // Nothing kept, nothing to clear.
        }
        this.data.set(this.defaults());
      },
    });
    if (typeof document !== 'undefined') {
      document.addEventListener(
        'visibilitychange',
        () => document.visibilityState === 'hidden' && this.flush(),
      );
    }
  }

  // ── Mode and gathering ────────────────────────────────────────────────

  /**
   * Tadabbur mode is entered on purpose (the lamp, or a card or the journal) and never outlives the
   * mushaf screen, so "continue reading" always lands on the khatma. Turning it off clears what was gathered.
   */
  setActive(on: boolean) {
    this.active.set(on);
    if (!on) {
      this.collection.set([]);
      this.targetId.set(null);
    }
  }

  isCollected(surah: number, ayah: number) {
    return this.collectedKeys().has(ayahKey(surah, ayah));
  }

  /** Tap on an ayah while gathering: in if it was out, out if it was in. Returns whether it is now in. */
  toggleCollected(ayah: CardAyah): boolean {
    if (this.isCollected(ayah.surah, ayah.ayah)) {
      this.collection.update((list) =>
        list.filter((a) => a.surah !== ayah.surah || a.ayah !== ayah.ayah),
      );
      return false;
    }
    this.collection.update((list) => withAyahs(list, [ayah]));
    return true;
  }

  collect(ayahs: CardAyah[]) {
    this.collection.update((list) => withAyahs(list, ayahs));
  }

  uncollect(surah: number, ayah: number) {
    this.collection.update((list) => list.filter((a) => a.surah !== surah || a.ayah !== ayah));
  }

  clearCollection() {
    this.collection.set([]);
  }

  /** Start gathering more ayahs for an existing card. */
  addTo(id: string) {
    this.targetId.set(id);
    this.collection.set([]);
    this.setActive(true);
  }

  // ── Reading time ──────────────────────────────────────────────────────

  /** A page read in tadabbur mode: counted here, never in the khatma. */
  addVisit(visit: PageVisit) {
    this.patch((d) => ({ ...d, days: addVisitToDays(d.days ?? {}, visit) }));
  }

  setLastPage(page: number) {
    this.lastPage.set(page);
    try {
      localStorage.setItem(PAGE_KEY, String(page));
    } catch {
      // Preference only.
    }
  }

  private loadPage(): number | null {
    try {
      const page = Number(localStorage.getItem(PAGE_KEY));
      return page >= 1 && page <= 604 ? page : null;
    } catch {
      return null;
    }
  }

  // ── Themes ────────────────────────────────────────────────────────────

  addTheme(name: string, color?: ThemeColor): TadabburTheme {
    const used = new Set(this.themes().map((t) => t.color));
    const theme: TadabburTheme = {
      id: newId('t'),
      name: name.trim() || 'موضوع جديد',
      color: color ?? THEME_COLORS.find((c) => !used.has(c)) ?? 'slate',
      updatedAt: Date.now(),
    };
    this.patch((d) => ({ ...d, themes: [...d.themes, theme] }));
    return theme;
  }

  updateTheme(id: string, change: Partial<Pick<TadabburTheme, 'name' | 'color'>>) {
    const name = change.name?.trim();
    if (change.name !== undefined && !name) return;
    this.patch((d) => ({
      ...d,
      themes: d.themes.map((t) =>
        t.id === id ? { ...t, ...change, ...(name ? { name } : {}), updatedAt: Date.now() } : t,
      ),
    }));
  }

  /** The theme goes; cards keep its id so undo brings every colour back as it was. */
  deleteTheme(id: string): { theme: TadabburTheme; index: number } | null {
    const index = this.themes().findIndex((t) => t.id === id);
    if (index < 0) return null;
    const theme = this.themes()[index];
    this.patch((d) => ({
      ...d,
      themes: d.themes.filter((t) => t.id !== id),
      removed: { ...d.removed, [id]: Date.now() },
    }));
    return { theme, index };
  }

  restoreTheme(theme: TadabburTheme, index: number) {
    this.patch((d) => {
      const themes = d.themes.filter((t) => t.id !== theme.id);
      themes.splice(Math.min(index, themes.length), 0, { ...theme, updatedAt: Date.now() });
      const { [theme.id]: _gone, ...removed } = d.removed;
      return { ...d, themes, removed };
    });
  }

  // ── Cards ─────────────────────────────────────────────────────────────

  get(id: string | null): Reflection | null {
    return id ? (this.reflections().find((r) => r.id === id) ?? null) : null;
  }

  /** Cards holding this ayah, the most recently edited first. */
  cardsWith(surah: number, ayah: number): Reflection[] {
    return this.reflections()
      .filter((r) => hasAyah(r, surah, ayah))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  create(
    ayahs: CardAyah[],
    opts: { title?: string; themes?: string[]; note?: string } = {},
  ): Reflection {
    const now = Date.now();
    const reflection: Reflection = {
      id: newId('r'),
      title: opts.title?.trim() ?? '',
      ayahs: withAyahs([], ayahs),
      themes: opts.themes ?? [],
      note: opts.note ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.patch((d) => ({ ...d, reflections: [...d.reflections, reflection] }));
    return reflection;
  }

  update(id: string, change: Partial<Pick<Reflection, 'title' | 'themes' | 'note'>>) {
    this.edit(id, (r) => ({ ...r, ...change }));
  }

  addAyahs(id: string, ayahs: CardAyah[]) {
    this.edit(id, (r) => ({ ...r, ayahs: withAyahs(r.ayahs, ayahs) }));
  }

  /** Takes one ayah off a card; returns it so it can be put back. */
  removeAyah(id: string, surah: number, ayah: number): CardAyah | null {
    const found = this.get(id)?.ayahs.find((a) => a.surah === surah && a.ayah === ayah) ?? null;
    if (found) this.edit(id, (r) => ({ ...r, ayahs: r.ayahs.filter((a) => a !== found) }));
    return found;
  }

  toggleTheme(id: string, themeId: string) {
    const r = this.get(id);
    if (!r) return;
    this.update(id, {
      themes: r.themes.includes(themeId)
        ? r.themes.filter((t) => t !== themeId)
        : [...r.themes, themeId],
    });
  }

  remove(id: string): { reflection: Reflection; index: number } | null {
    const index = this.reflections().findIndex((r) => r.id === id);
    if (index < 0) return null;
    const reflection = this.reflections()[index];
    this.patch((d) => ({
      ...d,
      reflections: d.reflections.filter((r) => r.id !== id),
      removed: { ...d.removed, [id]: Date.now() },
    }));
    if (this.targetId() === id) this.targetId.set(null);
    return { reflection, index };
  }

  restore(reflection: Reflection, index: number) {
    this.patch((d) => {
      const reflections = d.reflections.filter((r) => r.id !== reflection.id);
      reflections.splice(Math.min(index, reflections.length), 0, {
        ...reflection,
        updatedAt: Date.now(),
      });
      const { [reflection.id]: _gone, ...removed } = d.removed;
      return { ...d, reflections, removed };
    });
  }

  /** Send any pending change now (the page is being hidden). */
  flush() {
    if (!this.cloudTimer) return;
    clearTimeout(this.cloudTimer);
    this.cloudTimer = null;
    this.cloud?.touchDoc('tadabbur');
  }

  // ── Storage ───────────────────────────────────────────────────────────

  private edit(id: string, fn: (r: Reflection) => Reflection) {
    this.patch((d) => ({
      ...d,
      reflections: d.reflections.map((r) =>
        r.id === id ? { ...fn(r), updatedAt: Date.now() } : r,
      ),
    }));
  }

  private patch(fn: (d: TadabburData) => TadabburData) {
    this.data.update(fn);
    this.save();
  }

  /** A change made here: stamp it, keep it, and send it up once typing pauses. */
  private save() {
    this.saveLocal(Date.now());
    if (!this.cloud) return;
    if (this.cloudTimer) clearTimeout(this.cloudTimer);
    this.cloudTimer = setTimeout(() => {
      this.cloudTimer = null;
      this.cloud?.touchDoc('tadabbur');
    }, CLOUD_DEBOUNCE_MS);
  }

  private saveLocal(updatedAt: number) {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(this.data()));
      localStorage.setItem(UPDATED_KEY, String(updatedAt));
    } catch {
      // Storage full or unavailable: the session still works from memory.
    }
  }

  private load(): TadabburData {
    try {
      const saved = JSON.parse(localStorage.getItem(DATA_KEY) ?? 'null') as TadabburData | null;
      if (saved && Array.isArray(saved.themes) && Array.isArray(saved.reflections)) {
        return {
          themes: saved.themes,
          reflections: upgradeReflections(saved.reflections),
          removed: pruneRemoved(saved.removed ?? {}),
          days: saved.days ?? {},
        };
      }
    } catch {
      // Unreadable copy: start fresh.
    }
    return this.defaults();
  }

  private defaults(): TadabburData {
    return {
      themes: DEFAULT_THEMES.map((t) => ({ ...t })),
      reflections: [],
      removed: {},
      days: {},
    };
  }

  private updatedAt(): number {
    try {
      return Number(localStorage.getItem(UPDATED_KEY)) || 0;
    } catch {
      return 0;
    }
  }
}
