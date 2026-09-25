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
import { ar, AYAHS, CARDS, counted, dayMonth, SURAHS } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import {
  filterReflections,
  JournalSort,
  juzSpread,
  Reflection,
  reflectionsAsText,
  TadabburTheme,
  uniqueAyahs,
  THEME_COLORS,
  ThemeColor,
} from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { labelOf, ReflectionSheet } from './reflection-sheet';

/**
 * دفتر التدبر: every card the reader made, by theme. Pick "العذاب" and those cards sit together in
 * mushaf order, with the reader's notes under their ayahs and a map of where the ayahs fall.
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
  protected readonly labelOf = labelOf;
  protected readonly surahName = surahName;
  protected readonly ayahsCount = (n: number) => counted(n, AYAHS);
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
  protected readonly counts = computed(() => {
    const map = new Map<string, number>();
    for (const r of this.store.reflections())
      for (const id of r.themes) map.set(id, (map.get(id) ?? 0) + 1);
    return map;
  });
  protected readonly summary = computed(() => {
    const cards = this.store.reflections();
    if (!cards.length) return 'تتبّع مواضيع القرآن، ودوّن ما يفتحه الله عليك';
    return `${counted(cards.length, CARDS)}، ${counted(uniqueAyahs(cards).length, AYAHS)}`;
  });

  /** Where the listed ayahs fall across the 30 juz. */
  protected readonly spread = computed(() => {
    const counts = juzSpread(this.list());
    const max = Math.max(1, ...counts);
    return counts.map((n, i) => ({ juz: i + 1, n, level: n ? 0.25 + (0.75 * n) / max : 0 }));
  });
  protected readonly spreadLabel = computed(() => {
    const ayahs = uniqueAyahs(this.list());
    const surahs = new Set(ayahs.map((a) => a.surah)).size;
    return `${counted(ayahs.length, AYAHS)} في ${counted(surahs, SURAHS)}`;
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
    void this.router.navigate(['/quran'], { queryParams: { page: r.ayahs[0]?.page ?? 1 } });
  }

  /** "إضافة آيات" on a card: to the mushaf, where its last ayah is, gathering for that card. */
  protected addAyahs(r: Reflection) {
    this.store.addTo(r.id);
    void this.router.navigate(['/quran'], { queryParams: { page: r.ayahs.at(-1)?.page ?? 1 } });
  }

  /** "Start": straight into the mushaf in tadabbur mode. */
  protected startSession() {
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
      label: `حُذفت «${labelOf(reflection)}»`,
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
