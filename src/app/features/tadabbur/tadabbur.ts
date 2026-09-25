import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ar, AYAHS, counted, dayMonth, SURAHS, THEMES } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import {
  filterReflections,
  JournalSort,
  juzSpread,
  Reflection,
  reflectionsAsText,
  TadabburTheme,
  THEME_COLORS,
  ThemeColor,
} from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { rangeLabel, ReflectionSheet } from './reflection-sheet';

interface Section {
  surah: number | null;
  title: string;
  items: Reflection[];
}

/**
 * دفتر التدبر: every ayah the reader marked, by theme. Pick "العذاب" and the warnings of the whole
 * mushaf sit together, in order, with the reader's notes under them and a map of where they fall.
 */
@Component({
  selector: 'app-tadabbur',
  imports: [Icon, Sheet, FormsModule, ReflectionSheet],
  templateUrl: './tadabbur.html',
  styleUrl: './tadabbur.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tadabbur {
  protected readonly store = inject(TadabburStore);
  private readonly router = inject(Router);

  protected readonly ar = ar;
  protected readonly rangeLabel = rangeLabel;
  protected readonly dayMonth = dayMonth;
  protected readonly colors = THEME_COLORS;

  protected readonly filter = signal<string | null>(null);
  protected readonly query = signal('');
  protected readonly sort = signal<JournalSort>('mushaf');

  protected readonly activeTheme = computed(
    () => this.store.themes().find((t) => t.id === this.filter()) ?? null,
  );
  protected readonly list = computed(() =>
    filterReflections(this.store.reflections(), {
      theme: this.filter(),
      query: this.query(),
      sort: this.sort(),
      surahName,
    }),
  );
  protected readonly sections = computed<Section[]>(() => {
    const list = this.list();
    if (this.sort() === 'recent')
      return list.length ? [{ surah: null, title: '', items: list }] : [];
    const sections: Section[] = [];
    for (const r of list) {
      const last = sections.at(-1);
      if (last?.surah === r.surah) last.items.push(r);
      else sections.push({ surah: r.surah, title: `سورة ${surahName(r.surah)}`, items: [r] });
    }
    return sections;
  });

  protected readonly counts = computed(() => {
    const map = new Map<string, number>();
    for (const r of this.store.reflections())
      for (const id of r.themes) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  });
  protected readonly summary = computed(() => {
    const n = this.store.reflections().length;
    if (!n) return 'تتبّع مواضيع القرآن، ودوّن ما يفتحه الله عليك';
    return `${counted(n, AYAHS)}، ${counted(this.store.themes().length, THEMES)}`;
  });

  /** Where the listed ayahs fall across the 30 juz. */
  protected readonly spread = computed(() => {
    const counts = juzSpread(this.list());
    const max = Math.max(1, ...counts);
    return counts.map((n, i) => ({ juz: i + 1, n, level: n ? 0.25 + (0.75 * n) / max : 0 }));
  });
  protected readonly spreadLabel = computed(() => {
    const list = this.list();
    const surahs = new Set(list.map((r) => r.surah)).size;
    return `${counted(list.length, AYAHS)} في ${counted(surahs, SURAHS)}`;
  });
  protected readonly spreadColor = computed(
    () => `var(--t-${this.activeTheme()?.color ?? 'green'})`,
  );

  // The reflection card.
  protected readonly cardOpen = signal(false);
  protected readonly cardId = signal<string | null>(null);

  // Managing themes.
  protected readonly manageOpen = signal(false);
  protected readonly colorFor = signal<string | null>(null);
  newThemeName = '';

  protected readonly toast = signal<{ label: string; run?: () => void } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.toastTimer && clearTimeout(this.toastTimer));
  }

  protected themesOf(r: Reflection): TadabburTheme[] {
    const themes = this.store.themes();
    return r.themes
      .map((id) => themes.find((t) => t.id === id))
      .filter((t): t is TadabburTheme => !!t);
  }

  protected colorOf(r: Reflection): string {
    return `var(--t-${this.themesOf(r)[0]?.color ?? 'slate'})`;
  }

  protected setFilter(id: string | null) {
    this.filter.set(this.filter() === id ? null : id);
  }

  protected openCard(r: Reflection) {
    this.cardId.set(r.id);
    this.cardOpen.set(true);
  }

  protected goToMushaf(r: Reflection) {
    this.store.setActive(true);
    void this.router.navigate(['/quran'], { queryParams: { page: r.page } });
  }

  /** "Start": straight into the mushaf in tadabbur mode, looking for the theme on screen if one is picked. */
  protected startSession() {
    const theme = this.activeTheme();
    if (theme) this.store.setFocus(theme.id);
    this.store.setActive(true);
    void this.router.navigate(['/quran']);
  }

  protected async copyList() {
    const list = this.list();
    if (!list.length) return;
    try {
      await navigator.clipboard?.writeText(reflectionsAsText(list, surahName, ar));
      this.showToast({ label: `نُسخت ${counted(list.length, AYAHS)}` });
    } catch {
      this.showToast({ label: 'تعذّر النسخ' });
    }
  }

  protected onRemoved({ reflection, index }: { reflection: Reflection; index: number }) {
    this.showToast({
      label: `حُذفت ${rangeLabel(reflection)}`,
      run: () => this.store.restore(reflection, index),
    });
  }

  // ── Themes ────────────────────────────────────────────────────────────

  protected rename(theme: TadabburTheme, value: string) {
    if (value.trim() && value.trim() !== theme.name)
      this.store.updateTheme(theme.id, { name: value });
  }

  protected recolor(theme: TadabburTheme, color: ThemeColor) {
    this.store.updateTheme(theme.id, { color });
    this.colorFor.set(null);
  }

  protected addTheme() {
    const name = this.newThemeName.trim();
    if (!name) return;
    this.store.addTheme(name);
    this.newThemeName = '';
  }

  protected deleteTheme(theme: TadabburTheme) {
    const removed = this.store.deleteTheme(theme.id);
    if (!removed) return;
    if (this.filter() === theme.id) this.filter.set(null);
    this.showToast({
      label: `حُذف موضوع «${theme.name}»`,
      run: () => this.store.restoreTheme(removed.theme, removed.index),
    });
  }

  protected runUndo() {
    this.toast()?.run?.();
    this.dismissToast();
  }

  protected dismissToast() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  private showToast(toast: { label: string; run?: () => void }) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set(toast);
    this.toastTimer = setTimeout(() => this.toast.set(null), toast.run ? 6000 : 2500);
  }
}
