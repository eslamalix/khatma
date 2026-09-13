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

const WINDOW = 2;
const SETTLE_MS = 140;

type JumpTab = 'page' | 'surah' | 'juz';

@Component({
  selector: 'app-quran-reader',
  imports: [MushafPage, Icon, Sheet],
  templateUrl: './quran-reader.html',
  styleUrl: './quran-reader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.immersive]': 'ui.immersive()', '(document:keydown)': 'onKey($event)' },
})
export class QuranReader {
  protected readonly store = inject(ReadingStore);
  protected readonly ui = inject(UiState);
  private readonly timer = inject(ReadingTimer);
  private readonly pages = inject(QuranPages);
  private readonly pager = viewChild.required<ElementRef<HTMLElement>>('pager');
  private readonly injector = inject(Injector);

  protected readonly ar = ar;
  protected readonly total = TOTAL_PAGES;
  protected readonly surahs = SURAH_NAMES.map((name, i) => ({ n: i + 1, name, page: SURAH_START_PAGES[i] }));
  protected readonly juzs = JUZ_START_PAGES.map((page, i) => ({ n: i + 1, page }));

  protected readonly width = signal(0);
  /** Page under the viewport right now (follows the finger). */
  protected readonly visiblePage = signal(1);
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

  protected readonly jumpOpen = signal(false);
  protected readonly jumpTab = signal<JumpTab>('page');
  protected readonly textOpen = signal(false);

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
      // Fractional widths matter: a 0.3px error drifts a whole page after a few hundred pages.
      const measure = () => el.getBoundingClientRect().width;
      this.width.set(measure());
      const observer = new ResizeObserver(() => {
        if (measure() === this.width()) return;
        this.width.set(measure());
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

  protected onScroll() {
    const el = this.pager().nativeElement;
    const w = this.width();
    if (!w) return;
    const page = clampPage(Math.round(Math.abs(el.scrollLeft) / w) + 1);
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

  /** Tap in the middle of the page toggles immersive reading (P7). */
  protected onTap(event: MouseEvent) {
    const el = this.pager().nativeElement;
    const rect = el.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (x > 0.2 && x < 0.8 && !getSelection()?.toString()) this.ui.immersive.update((v) => !v);
  }

  protected onKey(event: KeyboardEvent) {
    const target = event.target;
    if (this.jumpOpen() || this.textOpen() || (target instanceof Element && target.closest('input, select, textarea'))) return;
    if (event.key === 'ArrowLeft') this.go(1);
    else if (event.key === 'ArrowRight') this.go(-1);
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
    const w = this.width() || el.getBoundingClientRect().width;
    el.scrollTo({ left: -(page - 1) * w, behavior: smooth ? 'smooth' : 'instant' });
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
