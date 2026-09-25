import { computed, Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import {
  buildMarks,
  DEFAULT_THEMES,
  isEmptyReflection,
  mergeTadabbur,
  pruneRemoved,
  Reflection,
  ReflectionDraft,
  reflectionAt,
  TadabburData,
  TadabburTheme,
  ThemeColor,
  THEME_COLORS,
} from './tadabbur';

const DATA_KEY = 'khatma.tadabbur';
const UPDATED_KEY = 'khatma.tadabbur.updated';
/** Device preferences, not synced: whether the reader is in tadabbur mode and which theme it looks for. */
const MODE_KEY = 'khatma.tadabbur.mode';
const FOCUS_KEY = 'khatma.tadabbur.focus';
/** Notes are typed a letter at a time; the cloud gets the text once the reader pauses. */
const CLOUD_DEBOUNCE_MS = 3000;

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * Tadabbur (docs/DECISIONS.md P20, T30): the reader's themes and the ayahs they marked under them, each
 * with an optional note. Kept on the device first and mirrored to one Firestore document like the groups.
 */
@Injectable({ providedIn: 'root' })
export class TadabburStore {
  private readonly data = signal<TadabburData>(this.load());
  readonly themes = computed(() => this.data().themes);
  readonly reflections = computed(() => this.data().reflections);
  /** Ayah key → what to paint on the page. */
  readonly marks = computed(() => buildMarks(this.reflections(), this.themes()));

  /** The reader is hunting for a theme: a tap on an ayah marks it instead of selecting it. */
  readonly active = signal(this.pref(MODE_KEY) === '1');
  /** The theme a tap marks with; null means a tap opens a free reflection. */
  readonly focusThemeId = signal<string | null>(this.loadFocus());
  readonly focusTheme = computed(
    () => this.themes().find((t) => t.id === this.focusThemeId()) ?? null,
  );

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
          reflections: data.reflections,
          removed: pruneRemoved(data.removed ?? {}),
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

  // ── Mode ──────────────────────────────────────────────────────────────

  setActive(on: boolean) {
    this.active.set(on);
    this.setPref(MODE_KEY, on ? '1' : null);
  }

  setFocus(themeId: string | null) {
    this.focusThemeId.set(themeId);
    this.setPref(FOCUS_KEY, themeId ?? '');
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

  /** The theme goes; reflections keep its id so undo brings every mark back as it was. */
  deleteTheme(id: string): { theme: TadabburTheme; index: number } | null {
    const index = this.themes().findIndex((t) => t.id === id);
    if (index < 0) return null;
    const theme = this.themes()[index];
    this.patch((d) => ({
      ...d,
      themes: d.themes.filter((t) => t.id !== id),
      removed: { ...d.removed, [id]: Date.now() },
    }));
    if (this.focusThemeId() === id) this.setFocus(this.themes()[0]?.id ?? null);
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

  themeCount(themeId: string) {
    return this.reflections().filter((r) => r.themes.includes(themeId)).length;
  }

  // ── Reflections ───────────────────────────────────────────────────────

  get(id: string | null): Reflection | null {
    return id ? (this.reflections().find((r) => r.id === id) ?? null) : null;
  }

  at(surah: number, ayah: number): Reflection | null {
    return reflectionAt(this.reflections(), surah, ayah);
  }

  /** The reflection saved for exactly this range, if the reader already wrote one. */
  exactly(surah: number, from: number, to: number): Reflection | null {
    return (
      this.reflections().find((r) => r.surah === surah && r.from === from && r.to === to) ?? null
    );
  }

  create(draft: ReflectionDraft, themes: string[] = [], note = ''): Reflection {
    const now = Date.now();
    const reflection: Reflection = {
      id: newId('r'),
      ...draft,
      themes,
      note,
      createdAt: now,
      updatedAt: now,
    };
    this.patch((d) => ({ ...d, reflections: [...d.reflections, reflection] }));
    return reflection;
  }

  update(id: string, change: Partial<Pick<Reflection, 'themes' | 'note'>>) {
    this.patch((d) => ({
      ...d,
      reflections: d.reflections.map((r) =>
        r.id === id ? { ...r, ...change, updatedAt: Date.now() } : r,
      ),
    }));
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

  /** A reflection left with no theme and no words is nothing worth keeping. */
  dropIfEmpty(id: string) {
    const r = this.get(id);
    if (r && isEmptyReflection(r)) this.remove(id);
  }

  /** Send any pending change now (the page is being hidden). */
  flush() {
    if (!this.cloudTimer) return;
    clearTimeout(this.cloudTimer);
    this.cloudTimer = null;
    this.cloud?.touchDoc('tadabbur');
  }

  // ── Storage ───────────────────────────────────────────────────────────

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
          reflections: saved.reflections,
          removed: pruneRemoved(saved.removed ?? {}),
        };
      }
    } catch {
      // Unreadable copy: start fresh.
    }
    return this.defaults();
  }

  private defaults(): TadabburData {
    return { themes: DEFAULT_THEMES.map((t) => ({ ...t })), reflections: [], removed: {} };
  }

  private updatedAt(): number {
    try {
      return Number(localStorage.getItem(UPDATED_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  /** Never chosen → the first starter theme; an empty value is a deliberate "free reflection". */
  private loadFocus(): string | null {
    try {
      const value = localStorage.getItem(FOCUS_KEY);
      return value === null ? DEFAULT_THEMES[0].id : value || null;
    } catch {
      return DEFAULT_THEMES[0].id;
    }
  }

  private pref(key: string): string | null {
    try {
      const value = localStorage.getItem(key);
      return value === '' ? null : value;
    } catch {
      return null;
    }
  }

  private setPref(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Preference only.
    }
  }
}
