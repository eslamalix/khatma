import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  ar,
  AYAHS,
  CARDS,
  counted,
  countedGenitive,
  DAYS,
  dayMonth,
  PAGES,
  shortDuration,
  SURAHS,
} from '../../core/format';
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
import { labelOf } from './reflection-sheet';

/**
 * دفتر التدبر: every card the reader made, by theme. Pick "العذاب" and those cards sit together in
 * mushaf order, with the reader's notes under their ayahs. Each card opens on its own page; the numbers
 * (time spent, where the ayahs fall) wait behind a button so the page stays on the ayahs.
 */
const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'narrow' });
const weekdayLong = new Intl.DateTimeFormat('ar-EG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

@Component({
  selector: 'app-tadabbur',
  imports: [Icon, Sheet, FormsModule, RouterLink],
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
  /** Themes that hold cards (and the one being filtered by), for the filter row. */
  protected readonly usedThemes = computed(() =>
    this.store.themes().filter((t) => this.counts().get(t.id) || t.id === this.filter()),
  );
  /** Search earns its place once there are enough cards to look through. */
  protected readonly showSearch = computed(
    () => this.store.reflections().length >= 6 || !!this.query(),
  );
  protected readonly listCount = computed(() => counted(this.list().length, CARDS));
  protected readonly statsLabel = computed(() => {
    const ms = this.stats().todayMs;
    return ms ? `اليوم ${shortDuration(ms)}` : 'الإحصائيات';
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
    return `${counted(ayahs.length, AYAHS)} في ${countedGenitive(surahs, SURAHS)}`;
  });
  protected readonly mapTitle = computed(() => {
    const theme = this.activeTheme();
    return theme ? `مواضع آيات «${theme.name}» في المصحف` : 'مواضع الآيات في المصحف';
  });
  protected readonly spreadColor = computed(
    () => `var(--t-${this.activeTheme()?.color ?? 'green'})`,
  );

  /** Tadabbur reading, kept apart from the khatma: time today, this week, overall, pages and days. */
  protected readonly stats = this.store.stats;
  protected readonly duration = shortDuration;
  protected readonly pagesLabel = (n: number) => counted(n, PAGES);
  protected readonly daysLabel = (n: number) => (n === 1 ? 'يوم واحد' : countedGenitive(n, DAYS));
  protected readonly week = computed(() => {
    const days = this.stats().week;
    const max = Math.max(1, ...days.map((d) => d.ms));
    return days.map((d) => ({
      ...d,
      label: weekday.format(new Date(`${d.date}T12:00:00`)),
      height: d.ms ? Math.max(6, Math.round((d.ms / max) * 100)) : 0,
      tip: `${weekdayLong.format(new Date(`${d.date}T12:00:00`))}: ${d.ms ? shortDuration(d.ms) : 'لا تدبّر'}`,
    }));
  });

  protected readonly statsOpen = signal(false);

  // Managing themes.
  protected readonly manageOpen = signal(false);
  protected readonly colorFor = signal<string | null>(null);
  newThemeName = '';

  protected readonly toast = signal<{ label: string; run?: () => void } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.toastTimer && clearTimeout(this.toastTimer));
    // A card deleted on its own page comes back here, with a way to undo.
    const removed = this.router.currentNavigation()?.extras.state?.['removed'] as
      | { reflection: Reflection; index: number }
      | undefined;
    if (removed?.reflection) this.onRemoved(removed);
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

  private onRemoved({ reflection, index }: { reflection: Reflection; index: number }) {
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
