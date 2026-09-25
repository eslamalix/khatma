import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  AyahRef,
} from '../../core/quran/quran-meta';
import { ar, AYAHS, counted, minSec, percent, shortDuration } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { MushafPage } from './mushaf-page';
import { QuranAyah } from '../../core/quran/quran-page';
import { AwradStore } from '../../core/awrad/awrad.store';
import { BackgroundTheme, ReadingMode } from '../../core/reading/reading';

import { QuranAudioService } from '../../core/quran/quran-audio.service';
import { TafsirService } from '../../core/quran/tafsir.service';
import { QuranPlayer } from './quran-player';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { CardAyah, Reflection } from '../../core/tadabbur/tadabbur';
import { labelOf, ReflectionSheet } from '../tadabbur/reflection-sheet';
import { CollectSheet } from '../tadabbur/collect-sheet';

const WINDOW = 2;
const SETTLE_MS = 140;
const TAFSIR_MAX_AYAHS = 10;
/** Wide enough (and landscape) for two facing pages, like an open mushaf on a desk. */
const SPREAD_MIN_WIDTH = 900;
/** Device preference: two facing pages on wide screens (on unless turned off). */
const SPREAD_KEY = 'khatma.spread';

const readSpreadPref = () => {
  try {
    return localStorage.getItem(SPREAD_KEY) !== '0';
  } catch {
    return true;
  }
};

type JumpTab = 'page' | 'surah' | 'juz';

export interface AyahRangeSelection {
  surah: number;
  startAyah: number;
  endAyah: number;
  ayahs: QuranAyah[];
}

@Component({
  selector: 'app-quran-reader',
  imports: [MushafPage, Icon, Sheet, FormsModule, QuranPlayer, ReflectionSheet, CollectSheet, RouterLink],
  templateUrl: './quran-reader.html',
  styleUrl: './quran-reader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.has-selection]': 'selectedRange() !== null',
    '[class.has-player]': 'audio.isActive()',
    '[class.tadabbur-on]': 'tadabbur.active()',
    '[attr.data-theme]': 'store.state().backgroundTheme',
    '(document:keydown)': 'onKey($event)',
  },
})
export class QuranReader {
  protected readonly store = inject(ReadingStore);
  protected readonly awradStore = inject(AwradStore);
  protected readonly audio = inject(QuranAudioService);
  protected readonly tafsirService = inject(TafsirService);
  protected readonly timer = inject(ReadingTimer);
  private readonly pages = inject(QuranPages);
  private readonly pager = viewChild.required<ElementRef<HTMLElement>>('pager');
  private readonly player = viewChild.required(QuranPlayer);
  private readonly injector = inject(Injector);
  protected readonly tadabbur = inject(TadabburStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly total = TOTAL_PAGES;
  protected readonly surahs = SURAH_NAMES.map((name, i) => ({ n: i + 1, name, page: SURAH_START_PAGES[i] }));
  protected readonly juzs = JUZ_START_PAGES.map((page, i) => ({ n: i + 1, page }));

  protected readonly width = signal(0);
  protected readonly height = signal(0);
  /** Page under the viewport right now (follows the finger). */
  readonly visiblePage = signal(1);

  /**
   * Two facing pages on a wide screen (P6): odd page on the right, even on the left, as in a printed
   * mushaf. The pager then moves by spreads ("units") instead of pages; `visiblePage` stays a page number,
   * the right-hand page of the spread.
   */
  protected readonly spreadPref = signal(readSpreadPref());
  protected readonly canSpread = computed(
    () => this.readingMode() === 'horizontal' && this.width() >= SPREAD_MIN_WIDTH && this.width() > this.height(),
  );
  protected readonly spread = computed(() => this.spreadPref() && this.canSpread());
  protected readonly unitCount = computed(() => (this.spread() ? Math.ceil(TOTAL_PAGES / 2) : TOTAL_PAGES));
  protected unitOf(page: number) {
    return this.spread() ? Math.ceil(page / 2) : page;
  }
  private firstPageOf(unit: number) {
    return this.spread() ? unit * 2 - 1 : unit;
  }
  /** The page a spread is named by (its right-hand, odd page); the page itself otherwise. */
  private normalize(page: number) {
    const p = clampPage(page);
    return this.spread() && p % 2 === 0 ? p - 1 : p;
  }
  protected readonly slides = computed(() => {
    const u = this.unitOf(this.visiblePage());
    const list: { unit: number; pages: number[] }[] = [];
    for (let i = Math.max(1, u - WINDOW); i <= Math.min(this.unitCount(), u + WINDOW); i++) {
      const first = this.firstPageOf(i);
      list.push({ unit: i, pages: this.spread() && first < TOTAL_PAGES ? [first, first + 1] : [first] });
    }
    return list;
  });
  protected readonly pageLabel = computed(() => {
    const p = this.visiblePage();
    return this.spread() && p < TOTAL_PAGES ? `${ar(p)}–${ar(p + 1)}` : ar(p);
  });
  /** Tadabbur time today, including the page open right now. */
  protected readonly tadabburToday = computed(() =>
    shortDuration(this.tadabbur.stats().todayMs + (this.tadabbur.active() ? this.timer.elapsedMs() : 0)),
  );
  protected readonly isLast = computed(() => this.unitOf(this.visiblePage()) >= this.unitCount());

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
  private lastTappedPage = 1;

  readonly selectionLabel = computed(() => {
    const r = this.selectedRange();
    if (!r) return '';
    const sName = surahName(r.surah);
    if (r.startAyah === r.endAyah) return `${sName}، الآية ${ar(r.startAyah)}`;
    return `${sName}، الآيات ${ar(r.startAyah)}–${ar(r.endAyah)}`;
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

  // Tafsir
  readonly tafsirOpen = signal<boolean>(false);
  readonly tafsirLoading = signal<boolean>(false);
  readonly tafsirItems = signal<{ ayah: number; text: string }[]>([]);
  readonly tafsirRef = signal<string>('');

  // Tadabbur: the card sheet, the save-to-card sheet, and an undo for the last change.
  protected readonly reflectionOpen = signal(false);
  protected readonly reflectionId = signal<string | null>(null);
  protected readonly collectOpen = signal(false);
  protected readonly undoToast = signal<{ text: string; run: () => void } | null>(null);
  protected readonly collectedCount = computed(() => counted(this.tadabbur.collection().length, AYAHS));
  protected readonly targetLabel = computed(() => {
    const t = this.tadabbur.target();
    return t ? labelOf(t) : '';
  });
  /** Tadabbur mode as last applied here; null until the reader has opened its first page. */
  private mode: boolean | null = null;
  /** "إضافة آيات" from a card: enter tadabbur on the page the reader is on. */
  private stayOnSwitch = false;
  private undoTimer: ReturnType<typeof setTimeout> | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  /** Page to keep while the pager is being resized (rotation, window resize). */
  private resizeHold: number | null = null;
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

      // Layout size from the observer entry: fractional (no drift across 604 slides) and immune to CSS transforms.
      const observer = new ResizeObserver(([entry]) => {
        const box = entry.contentBoxSize?.[0];
        const m = box ? { w: box.inlineSize, h: box.blockSize } : measure();
        if (m.w === this.width() && m.h === this.height()) return;
        // Scroll events during a resize measure the old offset against the new size; hold the page until re-aligned.
        this.resizeHold ??= this.visiblePage();
        const page = this.resizeHold;
        // Scroll snapping would re-snap to whichever slide it last tracked while slides move; pause it.
        el.style.scrollSnapType = 'none';
        this.width.set(m.w);
        this.height.set(m.h);
        this.afterRender(() => {
          this.scrollToPage(page, false);
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              el.style.scrollSnapType = '';
              this.resizeHold = null;
            }),
          );
        });
      });
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());

      await this.store.whenReady();
      // Tadabbur reading keeps its own place and its own time, apart from the khatma.
      const tadabbur = this.tadabbur.active();
      this.timer.setTarget(tadabbur ? 'tadabbur' : 'khatma');
      this.mode = tadabbur;
      const home = tadabbur ? (this.tadabbur.lastPage() ?? this.store.state().lastPage) : this.store.state().lastPage;
      // `/quran?page=N` (from the tadabbur journal) opens that page once, then the URL is tidied.
      const asked = Number(this.route.snapshot.queryParamMap.get('page'));
      const start = this.normalize(asked >= 1 ? asked : home);
      if (this.route.snapshot.queryParamMap.has('page')) {
        void this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      }
      this.visiblePage.set(start);
      this.scrollToPage(start, false);
      this.afterRender(() => this.scrollToPage(start, false));
      this.commit(start);
    });
    destroyRef.onDestroy(() => {
      this.timer.stop();
      // Leaving the mushaf ends tadabbur mode (gathered ayahs wait for the next visit).
      this.tadabbur.active.set(false);
      this.audio.stop();
      if (this.settleTimer) clearTimeout(this.settleTimer);
      if (this.undoTimer) clearTimeout(this.undoTimer);
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });

    // The moment today's wird is completed while reading: a quiet word and a soft haptic, nothing more.
    let wasDone: boolean | null = null;
    effect(() => {
      const done = this.store.wird()?.done ?? null;
      if (wasDone === false && done) {
        untracked(() => {
          this.showToast('أتممت وردك اليوم، بارك الله فيك', 3200);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([15, 50, 25]);
        });
      }
      if (this.store.ready()) wasDone = done;
    });

    // Entering or leaving tadabbur (from the lamp, or from "add ayahs" on a card) swaps where time goes
    // and which place in the mushaf the reader is at.
    effect(() => {
      const on = this.tadabbur.active();
      untracked(() => {
        if (this.mode === null || on === this.mode) return;
        this.mode = on;
        this.switchMode(on);
      });
    });

    // Two pages or one after a resize or a setting change: re-align on the same spread and re-time it.
    effect(() => {
      this.spread();
      untracked(() => {
        if (this.mode === null) return;
        const page = this.normalize(this.visiblePage());
        this.visiblePage.set(page);
        this.afterRender(() => this.scrollToPage(page, false));
        this.commit(page);
      });
    });

    // Recitation leads the reader: highlight follows the ayah and pages turn on their own.
    effect(() => {
      const cur = this.audio.current();
      if (cur) untracked(() => this.followRecitation(cur));
    });
  }

  protected slideOffset(unit: number) {
    return (unit - 1) * this.width();
  }

  protected slideOffsetVertical(page: number) {
    return (page - 1) * this.height();
  }

  protected onScroll() {
    const el = this.pager().nativeElement;
    const isVert = this.readingMode() === 'vertical';
    const size = isVert ? this.height() : this.width();
    if (!size || this.resizeHold !== null) return;
    if (Math.abs((isVert ? el.clientHeight : el.clientWidth) - size) > 1) return; // size signal not caught up yet
    const scrollPos = isVert ? el.scrollTop : Math.abs(el.scrollLeft);
    const unit = Math.min(this.unitCount(), Math.max(1, Math.round(scrollPos / size) + 1));
    const page = this.firstPageOf(unit);
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
    this.goTo(this.visiblePage() + delta * (this.spread() ? 2 : 1));
  }

  protected goTo(target: number) {
    const page = this.normalize(target);
    if (page === this.visiblePage()) return;
    const near = Math.abs(this.unitOf(page) - this.unitOf(this.visiblePage())) <= 1;
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

  /**
   * Ayah selection. Tap an ayah to select it; tap another in the same surah to select the whole range.
   * Tapping an ayah at either edge of the selection takes it back out (the last one clears the selection),
   * and tapping inside the range shortens it to end there.
   */
  protected onAyahClicked(event: { ayah: QuranAyah; pageAyahs: QuranAyah[]; page: number }) {
    const { ayah, pageAyahs } = event;
    if (this.tadabbur.active()) {
      this.tadabburTap(event);
      return;
    }
    this.lastPageAyahs.set(pageAyahs);
    this.lastTappedPage = event.page;
    const cur = this.selectedRange();

    if (!cur || cur.surah !== ayah.surah) {
      this.setSelection(ayah.surah, ayah.ayah, ayah.ayah, pageAyahs);
      return;
    }

    const n = ayah.ayah;
    if (n >= cur.startAyah && n <= cur.endAyah) {
      if (cur.startAyah === cur.endAyah) this.selectedRange.set(null);
      else if (n === cur.endAyah) this.setSelection(cur.surah, cur.startAyah, n - 1, pageAyahs);
      else if (n === cur.startAyah) this.setSelection(cur.surah, n + 1, cur.endAyah, pageAyahs);
      else this.setSelection(cur.surah, cur.startAyah, n, pageAyahs);
    } else {
      this.setSelection(cur.surah, Math.min(cur.startAyah, n), Math.max(cur.endAyah, n), pageAyahs);
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
  }

  private setSelection(surah: number, start: number, end: number, pageAyahs: QuranAyah[]) {
    const ayahs = pageAyahs.filter((x) => x.surah === surah && x.ayah >= start && x.ayah <= end).sort((a, b) => a.ayah - b.ayah);
    this.selectedRange.set({ surah, startAyah: start, endAyah: end, ayahs });
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
    this.showToast(`تم حفظ المقطع في «${groupTitle}»`);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([15, 30, 15]);
    }
  }

  // ── Tadabbur ──────────────────────────────────────────────────────────

  protected toggleTadabbur() {
    const on = !this.tadabbur.active();
    this.selectedRange.set(null);
    this.dismissUndo();
    const hasPlace = this.tadabbur.lastPage() !== null;
    this.tadabbur.setActive(on);
    if (on && !hasPlace) this.showToast('المس الآيات التي تريد جمعها، متتالية أو متفرقة', 3000);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
  }

  /**
   * Gathering: each tap puts an ayah in (or takes it back out of) the collection, across pages and surahs,
   * until it is saved on a card. With nothing gathered yet, a tap on an ayah already on a card opens that card.
   */
  private tadabburTap({ ayah, page }: { ayah: QuranAyah; page: number }) {
    const gathering = this.tadabbur.collection().length > 0 || this.tadabbur.targetId() !== null;
    const cards = this.tadabbur.cardsWith(ayah.surah, ayah.ayah);
    if (!gathering && cards.length) {
      this.openReflection(cards[0].id);
      return;
    }
    this.tadabbur.toggleCollected(this.cardAyah(ayah, page));
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
  }

  private cardAyah(ayah: QuranAyah, page: number): CardAyah {
    return { surah: ayah.surah, ayah: ayah.ayah, page, text: ayah.words.join(' ') };
  }

  /** The strip's main button: straight onto the chosen card, or pick one. */
  protected saveCollection() {
    const target = this.tadabbur.target();
    if (!target) {
      this.collectOpen.set(true);
      return;
    }
    const ayahs = this.tadabbur.collection();
    this.tadabbur.addAyahs(target.id, ayahs);
    this.tadabbur.clearCollection();
    this.tadabbur.targetId.set(null);
    this.openReflection(target.id);
  }

  protected cancelGathering() {
    this.tadabbur.clearCollection();
    this.tadabbur.targetId.set(null);
  }

  protected onCollected(card: Reflection) {
    this.collectOpen.set(false);
    this.openReflection(card.id);
  }

  /** The selection bar's "تدبّر": the selected ayahs go straight to the save-to-card sheet. */
  protected reflectOnSelection() {
    const r = this.selectedRange();
    if (!r) return;
    this.tadabbur.collect(r.ayahs.map((a) => this.cardAyah(a, this.lastTappedPage)));
    this.selectedRange.set(null);
    this.collectOpen.set(true);
  }

  private openReflection(id: string) {
    this.dismissUndo();
    this.reflectionId.set(id);
    this.reflectionOpen.set(true);
  }

  /** "إضافة آيات" on a card: back to the page, gathering for that card. */
  protected onAddAyahs(card: Reflection) {
    this.stayOnSwitch = !this.tadabbur.active();
    this.tadabbur.addTo(card.id);
    this.showToast(`المس الآيات لتضيفها إلى «${labelOf(card)}»`, 3000);
  }

  protected onReflectionRemoved({ reflection, index }: { reflection: Reflection; index: number }) {
    this.offerUndo('حُذفت البطاقة', () => this.tadabbur.restore(reflection, index));
  }

  protected runUndo() {
    this.undoToast()?.run();
    this.dismissUndo();
  }

  private offerUndo(text: string, run: () => void) {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.saveToast.set(null);
    this.undoToast.set({ text, run });
    this.undoTimer = setTimeout(() => this.undoToast.set(null), 4500);
  }

  private dismissUndo() {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = null;
    this.undoToast.set(null);
  }

  private showToast(text: string, ms = 2500) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.saveToast.set(text);
    this.toastTimer = setTimeout(() => this.saveToast.set(null), ms);
  }

  /** Tapping the page outside an ayah clears the selection. */
  protected onTap() {
    this.selectedRange.set(null);
  }

  /** Tafsir for the whole selection, one card per ayah (capped so a long range stays readable). */
  openTafsir() {
    const r = this.selectedRange();
    if (!r) return;
    const ayahs = r.ayahs.slice(0, TAFSIR_MAX_AYAHS);
    this.tafsirRef.set(this.selectionLabel());
    this.tafsirOpen.set(true);
    this.tafsirLoading.set(true);
    this.tafsirItems.set([]);
    Promise.all(ayahs.map((a) => this.tafsirService.getTafsir(a.surah, a.ayah))).then((texts) => {
      this.tafsirItems.set(ayahs.map((a, i) => ({ ayah: a.ayah, text: texts[i] })));
      this.tafsirLoading.set(false);
    });
  }

  /** One ayah plays onward like a mushaf recitation; a range plays just that passage. */
  protected playSelection() {
    const r = this.selectedRange();
    if (!r) return;
    const from = { surah: r.surah, ayah: r.startAyah };
    this.audio.playRange(from, r.startAyah === r.endAyah ? null : { surah: r.surah, ayah: r.endAyah });
    this.selectedRange.set(null);
  }

  /** Header button: open the player if reciting, otherwise recite from the top of the visible page. */
  protected async listen() {
    if (this.audio.isActive()) {
      this.player().open();
      return;
    }
    const page = await this.pages.get(this.visiblePage()).catch(() => null);
    const first = page?.ayahs[0];
    if (first) this.audio.playRange({ surah: first.surah, ayah: first.ayah });
  }

  private async followRecitation(cur: AyahRef) {
    this.timer.ping();
    const here = this.visiblePage();
    for (const p of [here, here + 1, here - 1, here + 2]) {
      if (p < 1 || p > TOTAL_PAGES) continue;
      const page = await this.pages.get(p).catch(() => null);
      if (!page?.ayahs.some((a) => a.surah === cur.surah && a.ayah === cur.ayah)) continue;
      // Only turn if this is still the ayah playing and the reader has not moved meanwhile.
      if (this.unitOf(p) !== this.unitOf(here) && this.audio.current() === cur && this.visiblePage() === here) {
        this.goTo(p);
      }
      return;
    }
  }

  protected onKey(event: KeyboardEvent) {
    const target = event.target;
    if (
      this.jumpOpen() ||
      this.settingsOpen() ||
      this.saveToGroupOpen() ||
      this.tafsirOpen() ||
      this.reflectionOpen() ||
      this.collectOpen() ||
      (target instanceof Element && target.closest('input, select, textarea'))
    ) {
      return;
    }

    if (event.key === 'Escape') {
      if (this.tafsirOpen()) {
        this.tafsirOpen.set(false);
        return;
      }
      if (this.selectedRange()) {
        this.selectedRange.set(null);
        return;
      }
    }

    if (event.key === ' ' && !this.tafsirOpen()) {
      event.preventDefault();
      this.go(1);
    } else if ((event.key === 't' || event.key === 'T') && this.selectedRange()) {
      this.openTafsir();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      this.go(1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      this.go(-1);
    } else if ((event.ctrlKey || event.metaKey) && (event.key === '=' || event.key === '+')) {
      this.zoom(0.1, event);
    } else if ((event.ctrlKey || event.metaKey) && event.key === '-') {
      this.zoom(-0.1, event);
    }
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
      el.scrollTo({ left: -(this.unitOf(page) - 1) * w, behavior: smooth ? 'smooth' : 'instant' });
    }
  }

  private afterRender(fn: () => void) {
    afterNextRender(fn, { injector: this.injector });
  }

  /** Start timing the page (and its facing page in a spread, which shares the time). */
  private commit(page: number) {
    const partner = this.spread() && page < TOTAL_PAGES ? page + 1 : null;
    this.timer.open(page, partner);
    this.pages.prefetch(page, this.spread() ? 3 : 2);
  }

  protected setSpread(on: boolean) {
    this.spreadPref.set(on);
    try {
      localStorage.setItem(SPREAD_KEY, on ? '1' : '0');
    } catch {
      // Preference only.
    }
  }

  /** Each mode reopens where it was left: tadabbur never moves the khatma's place, nor the other way. */
  private switchMode(on: boolean) {
    const khatmaPage = this.store.state().lastPage;
    const tadabburPage = this.tadabbur.lastPage();
    this.timer.setTarget(on ? 'tadabbur' : 'khatma');
    const stay = this.stayOnSwitch;
    this.stayOnSwitch = false;
    const to = this.normalize(on ? (stay ? this.visiblePage() : (tadabburPage ?? this.visiblePage())) : khatmaPage);
    if (to !== this.visiblePage()) {
      this.showToast(on ? `تكمل تدبّرك من صفحة ${ar(to)}` : `رجعت لموضعك في الختمة، صفحة ${ar(to)}`, 2600);
    }
    this.goTo(to);
    this.commit(to);
  }
}

function touchDistance(event: TouchEvent) {
  const [a, b] = [event.touches[0], event.touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
