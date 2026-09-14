import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReadingStore } from '../../core/reading/reading.store';
import { ReadingTimer } from '../../core/timing/reading-timer';
import { QuranPages } from '../../core/quran/quran-pages.service';
import {
  clampPage,
  JUZ_START_PAGES,
  juzAtPage,
  SURAH_NAMES,
  SURAH_START_PAGES,
  surahAtPage,
  surahName,
  TOTAL_PAGES,
} from '../../core/quran/quran-meta';
import { ar, minSec, percent, shortDuration } from '../../core/format';
import { UiState } from '../../ui/ui-state';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { MushafPage } from './mushaf-page';
import { QuranAyah } from '../../core/quran/quran-page';
import { AwradStore } from '../../core/awrad/awrad.store';
import { BackgroundTheme, ReadingMode } from '../../core/reading/reading';

const WINDOW = 2;
const SETTLE_MS = 140;

type JumpTab = 'page' | 'surah' | 'juz';

export interface AyahRangeSelection {
  surah: number;
  startAyah: number;
  endAyah: number;
  ayahs: QuranAyah[];
}

@Component({
  selector: 'app-quran-reader',
  imports: [MushafPage, Icon, Sheet, FormsModule],
  templateUrl: './quran-reader.html',
  styleUrl: './quran-reader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.immersive]': 'ui.immersive()',
    '[class.has-selection]': 'selectedRange() !== null',
    '[attr.data-theme]': 'store.state().backgroundTheme',
    '(document:keydown)': 'onKey($event)',
  },
})
export class QuranReader {
  protected readonly store = inject(ReadingStore);
  protected readonly ui = inject(UiState);
  protected readonly awradStore = inject(AwradStore);
  private readonly timer = inject(ReadingTimer);
  private readonly pages = inject(QuranPages);
  private readonly pager = viewChild.required<ElementRef<HTMLElement>>('pager');
  private readonly injector = inject(Injector);

  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly total = TOTAL_PAGES;
  protected readonly surahs = SURAH_NAMES.map((name, i) => ({ n: i + 1, name, page: SURAH_START_PAGES[i] }));
  protected readonly juzs = JUZ_START_PAGES.map((page, i) => ({ n: i + 1, page }));

  protected readonly width = signal(0);
  protected readonly height = signal(0);
  /** Page under the viewport right now (follows the finger). */
  readonly visiblePage = signal(1);
  protected readonly slides = computed(() => {
    const p = this.visiblePage();
    const list: number[] = [];
    for (let i = Math.max(1, p - WINDOW); i <= Math.min(TOTAL_PAGES, p + WINDOW); i++) list.push(i);
    return list;
  });

  protected readonly surahLabel = computed(() => surahName(surahAtPage(this.visiblePage())));
  protected readonly juzLabel = computed(() => `الجزء ${ar(juzAtPage(this.visiblePage()))}`);

  private readonly k = this.store.kpis;
  protected readonly avg = computed(() => `${minSec(this.k().avgMs)} د`);
  protected readonly remainingPct = computed(() => percent(this.k().remainingRatio));
  protected readonly remainingTime = computed(() => shortDuration(this.k().remainingMs));

  // Sheets
  protected readonly jumpOpen = signal(false);
  protected readonly jumpTab = signal<JumpTab>('page');
  protected readonly settingsOpen = signal(false);

  // Settings
  protected readonly backgroundTheme = computed(() => this.store.state().backgroundTheme);
  protected readonly readingMode = computed(() => this.store.state().readingMode);

  // Multiple Ayah Selection & Groups
  readonly selectedRange = signal<AyahRangeSelection | null>(null);
  readonly lastPageAyahs = signal<QuranAyah[]>([]);

  readonly selectionLabel = computed(() => {
    const r = this.selectedRange();
    if (!r) return '';
    const sName = surahName(r.surah);
    if (r.startAyah === r.endAyah) {
      return `سورة ${sName} : ${ar(r.startAyah)}`;
    }
    return `سورة ${sName} : ${ar(r.startAyah)} - ${ar(r.endAyah)} (${ar(r.ayahs.length)} آيات)`;
  });

  protected readonly canShrink = computed(() => {
    const r = this.selectedRange();
    return !!r && r.endAyah > r.startAyah;
  });

  protected readonly canExpand = computed(() => {
    const r = this.selectedRange();
    if (!r) return false;
    const list = this.lastPageAyahs().filter((a) => a.surah === r.surah);
    if (!list.length) return false;
    const maxAyah = Math.max(...list.map((a) => a.ayah));
    return r.endAyah < maxAyah;
  });

  protected readonly copiedToast = signal(false);
  protected readonly saveToast = signal<string | null>(null);

  protected readonly saveToGroupOpen = signal(false);
  protected readonly targetGroupId = signal<string>('tahseen');
  protected readonly repeatCount = signal<number>(1);
  newGroupInput = '';
  protected readonly isAddingNewGroup = signal<boolean>(false);

  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Page a button/keyboard turn is animating to; scroll events in between must not move the counter back. */
  private turningTo: number | null = null;
  private pinch: { distance: number; scale: number } | null = null;
  protected readonly liveScale = signal<number | null>(null);
  protected readonly scale = computed(() => this.liveScale() ?? this.store.state().fontScale);
  protected readonly scalePct = computed(() => percent(this.scale()));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(async () => {
      const el = this.pager().nativeElement;
      const measure = () => {
        const rect = el.getBoundingClientRect();
        return { w: rect.width, h: rect.height };
      };
      const initial = measure();
      this.width.set(initial.w);
      this.height.set(initial.h);

      const observer = new ResizeObserver(() => {
        const m = measure();
        if (m.w === this.width() && m.h === this.height()) return;
        this.width.set(m.w);
        this.height.set(m.h);
        this.afterRender(() => this.scrollToPage(this.visiblePage(), false));
      });
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());

      await this.store.whenReady();
      const start = clampPage(this.store.state().lastPage);
      this.visiblePage.set(start);
      this.scrollToPage(start, false);
      this.afterRender(() => this.scrollToPage(start, false));
      this.commit(start);
    });
    destroyRef.onDestroy(() => {
      this.timer.stop();
      this.ui.immersive.set(false);
      if (this.settleTimer) clearTimeout(this.settleTimer);
    });
  }

  protected slideOffset(page: number) {
    return (page - 1) * this.width();
  }

  protected slideOffsetVertical(page: number) {
    return (page - 1) * this.height();
  }

  protected onScroll() {
    const el = this.pager().nativeElement;
    const isVert = this.readingMode() === 'vertical';
    const size = isVert ? this.height() : this.width();
    if (!size) return;
    const scrollPos = isVert ? el.scrollTop : Math.abs(el.scrollLeft);
    const page = clampPage(Math.round(scrollPos / size) + 1);
    if (this.turningTo === page) this.turningTo = null;
    if (this.turningTo === null && page !== this.visiblePage()) this.visiblePage.set(page);
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.turningTo = null;
      this.visiblePage.set(page);
      this.commit(page);
    }, SETTLE_MS);
  }

  protected go(delta: number) {
    this.goTo(this.visiblePage() + delta);
  }

  protected goTo(target: number) {
    const page = clampPage(target);
    const near = Math.abs(page - this.visiblePage()) <= 1;
    this.turningTo = near ? page : null;
    this.visiblePage.set(page);
    // Render the target slide first, then scroll: smooth for a page turn, instant for a jump.
    this.afterRender(() => this.scrollToPage(page, near));
    if (!near) this.commit(page);
  }

  protected jump(page: number) {
    this.jumpOpen.set(false);
    this.goTo(page);
  }

  protected jumpToInput(input: HTMLInputElement) {
    const value = Number(input.value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    if (value >= 1 && value <= TOTAL_PAGES) this.jump(value);
  }

  protected openJump(tab: JumpTab) {
    this.jumpTab.set(tab);
    this.jumpOpen.set(true);
  }

  protected setBackgroundTheme(theme: BackgroundTheme) {
    this.store.setBackgroundTheme(theme);
  }

  protected setReadingMode(mode: ReadingMode) {
    this.store.setReadingMode(mode);
    this.afterRender(() => this.scrollToPage(this.visiblePage(), false));
  }

  /** Ayah selection: single or multiple consecutive ayahs */
  protected onAyahClicked(event: { ayah: QuranAyah; pageAyahs: QuranAyah[] }) {
    const { ayah, pageAyahs } = event;
    this.lastPageAyahs.set(pageAyahs);
    const cur = this.selectedRange();

    if (!cur || cur.surah !== ayah.surah) {
      this.selectedRange.set({
        surah: ayah.surah,
        startAyah: ayah.ayah,
        endAyah: ayah.ayah,
        ayahs: [ayah],
      });
      return;
    }

    // Same surah clicked
    if (cur.startAyah === cur.endAyah && cur.startAyah === ayah.ayah) {
      // Toggle off when clicking the single selected ayah again
      this.selectedRange.set(null);
      return;
    }

    let start: number;
    let end: number;

    if (cur.startAyah === cur.endAyah) {
      // Anchor established, expand range
      start = Math.min(cur.startAyah, ayah.ayah);
      end = Math.max(cur.startAyah, ayah.ayah);
    } else {
      if (ayah.ayah === cur.startAyah) {
        start = cur.startAyah;
        end = cur.startAyah;
      } else {
        start = Math.min(cur.startAyah, ayah.ayah);
        end = Math.max(cur.startAyah, ayah.ayah);
      }
    }

    const rangeAyahs = pageAyahs
      .filter((x) => x.surah === ayah.surah && x.ayah >= start && x.ayah <= end)
      .sort((a, b) => a.ayah - b.ayah);

    this.selectedRange.set({
      surah: ayah.surah,
      startAyah: start,
      endAyah: end,
      ayahs: rangeAyahs.length > 0 ? rangeAyahs : [ayah],
    });
  }

  /** Expand or shrink the selection by one ayah using the bottom bar stepper */
  protected expandSelection(delta: number) {
    const cur = this.selectedRange();
    if (!cur) return;
    const list = this.lastPageAyahs()
      .filter((a) => a.surah === cur.surah)
      .sort((a, b) => a.ayah - b.ayah);
    if (!list.length) return;
    const maxAyah = list[list.length - 1].ayah;
    let nextEnd = cur.endAyah + delta;
    if (nextEnd < cur.startAyah) nextEnd = cur.startAyah;
    if (nextEnd > maxAyah) nextEnd = maxAyah;
    if (nextEnd === cur.endAyah) return;
    const rangeAyahs = list.filter((a) => a.ayah >= cur.startAyah && a.ayah <= nextEnd);
    this.selectedRange.set({
      surah: cur.surah,
      startAyah: cur.startAyah,
      endAyah: nextEnd,
      ayahs: rangeAyahs.length > 0 ? rangeAyahs : cur.ayahs,
    });
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
  }

  protected async copySelection() {
    const r = this.selectedRange();
    if (!r) return;
    const ayahsText = r.ayahs.map((a) => `${a.words.join(' ')} ﴿${ar(a.ayah)}﴾`).join(' ');
    const ref =
      r.startAyah === r.endAyah
        ? `[سورة ${surahName(r.surah)}: ${ar(r.startAyah)}]`
        : `[سورة ${surahName(r.surah)}: ${ar(r.startAyah)} - ${ar(r.endAyah)}]`;
    const textToCopy = `${ayahsText} ${ref}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      }
    } catch {
      // Fallback
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(20);
    }
    this.copiedToast.set(true);
    setTimeout(() => this.copiedToast.set(false), 2000);
  }

  protected openSaveToGroup() {
    const grps = this.awradStore.groups();
    if (grps.length > 0 && !this.targetGroupId()) {
      this.targetGroupId.set(grps[0].id);
    }
    this.isAddingNewGroup.set(false);
    this.newGroupInput = '';
    this.saveToGroupOpen.set(true);
  }

  protected confirmSaveToGroup() {
    const r = this.selectedRange();
    if (!r) return;

    let groupId = this.targetGroupId();
    let groupTitle = '';

    if (this.isAddingNewGroup()) {
      const name = this.newGroupInput.trim();
      if (!name) return;
      const newG = this.awradStore.addGroup(name);
      groupId = newG.id;
      groupTitle = newG.title;
    } else {
      const existing = this.awradStore.groups().find((g) => g.id === groupId);
      groupTitle = existing?.title || 'المجموعة';
    }

    const rangeLabel =
      r.startAyah === r.endAyah
        ? ar(r.startAyah)
        : `${ar(r.startAyah)} - ${ar(r.endAyah)}`;

    const passageText = r.ayahs.map((a) => a.words.join(' ')).join(' ۝ ');

    this.awradStore.addPassageToGroup(groupId, {
      title: `${surahName(r.surah)}: ${rangeLabel}`,
      reference: `سورة ${surahName(r.surah)}: ${rangeLabel}`,
      text: passageText,
      targetRepeat: this.repeatCount(),
    });

    this.saveToGroupOpen.set(false);
    this.selectedRange.set(null);
    this.saveToast.set(`تم حفظ المقطع في «${groupTitle}»`);
    setTimeout(() => this.saveToast.set(null), 2500);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
  }

  /** Tap in the middle of the page toggles immersive reading (P7), or clears ayah selection if active. */
  protected onTap(event: MouseEvent) {
    if (this.selectedRange()) {
      this.selectedRange.set(null);
      return;
    }
    const el = this.pager().nativeElement;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (x > 0.2 && x < 0.8 && !getSelection()?.toString()) this.ui.immersive.update((v) => !v);
  }

  protected onKey(event: KeyboardEvent) {
    const target = event.target;
    if (
      this.jumpOpen() ||
      this.settingsOpen() ||
      this.saveToGroupOpen() ||
      (target instanceof Element && target.closest('input, select, textarea'))
    ) {
      return;
    }

    if (event.key === 'Escape') {
      if (this.selectedRange()) {
        this.selectedRange.set(null);
        return;
      }
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') this.go(1);
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') this.go(-1);
    else if ((event.ctrlKey || event.metaKey) && (event.key === '=' || event.key === '+')) this.zoom(0.1, event);
    else if ((event.ctrlKey || event.metaKey) && event.key === '-') this.zoom(-0.1, event);
  }

  protected zoom(delta: number, event?: Event) {
    event?.preventDefault();
    this.store.setFontScale(this.store.state().fontScale + delta);
  }

  protected onWheel(event: WheelEvent) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    this.store.setFontScale(this.store.state().fontScale * (1 - event.deltaY / 500));
  }

  protected onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) this.pinch = { distance: touchDistance(event), scale: this.store.state().fontScale };
  }

  protected onTouchMove(event: TouchEvent) {
    if (!this.pinch || event.touches.length !== 2) return;
    const next = this.pinch.scale * (touchDistance(event) / this.pinch.distance);
    this.liveScale.set(Math.min(2, Math.max(0.7, next)));
  }

  protected onTouchEnd() {
    if (!this.pinch) return;
    this.pinch = null;
    const live = this.liveScale();
    if (live !== null) this.store.setFontScale(live);
    this.liveScale.set(null);
  }

  private scrollToPage(page: number, smooth: boolean) {
    const el = this.pager().nativeElement;
    const isVert = this.readingMode() === 'vertical';
    if (isVert) {
      const h = this.height() || el.getBoundingClientRect().height;
      el.scrollTo({ top: (page - 1) * h, behavior: smooth ? 'smooth' : 'instant' });
    } else {
      const w = this.width() || el.getBoundingClientRect().width;
      el.scrollTo({ left: -(page - 1) * w, behavior: smooth ? 'smooth' : 'instant' });
    }
  }

  private afterRender(fn: () => void) {
    afterNextRender(fn, { injector: this.injector });
  }

  private commit(page: number) {
    this.timer.open(page);
    this.pages.prefetch(page);
  }
}

function touchDistance(event: TouchEvent) {
  const [a, b] = [event.touches[0], event.touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
