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
  input,
  output,
  signal,
} from '@angular/core';
import { QuranPages } from '../../core/quran/quran-pages.service';
import { QuranAyah, QuranPage } from '../../core/quran/quran-page';
import { ar } from '../../core/format';
import { AYAH_COUNTS, surahName } from '../../core/quran/quran-meta';
import { AyahMark, ayahKey } from '../../core/tadabbur/tadabbur';

/** How far a page may grow or shrink its text to fill the screen before the reader's own zoom applies. */
const FIT_MIN = 0.9;
const FIT_MAX = 1.35;

type Block = { kind: 'header'; surah: number; basmala: boolean } | { kind: 'text'; ayahs: QuranAyah[] };

/**
 * One mushaf page. Text reflows to the screen; the page's ayahs never change (Q2).
 * Each page sizes its text so it fills the screen like a printed page, then the reader's zoom scales that.
 */
@Component({
  selector: 'app-mushaf-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mushaf-page.html',
  styleUrl: './mushaf-page.scss',
  host: { '[style.--scale]': 'fontScale()', '[class.opening]': 'page() <= 2' },
})
export class MushafPage {
  private readonly pages = inject(QuranPages);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly page = input.required<number>();
  readonly fontScale = input(1);
  readonly selectedRange = input<{ surah: number; startAyah: number; endAyah: number } | null>(null);
  readonly playingAyah = input<{ surah: number; ayah: number } | null>(null);
  /** Ayahs the reader marked while reflecting (keyed `surah:ayah`). */
  readonly marks = input<ReadonlyMap<string, AyahMark> | null>(null);
  /** Tadabbur mode: marks are drawn as coloured bands; otherwise only their ornament is tinted. */
  readonly markMode = input(false);
  readonly ayahClicked = output<{ ayah: QuranAyah; pageAyahs: QuranAyah[]; page: number }>();

  protected readonly data = signal<QuranPage | null>(null);
  protected readonly failed = signal(false);
  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly ayahCount = (surah: number) => AYAH_COUNTS[surah - 1];

  protected isAyahSelected(a: QuranAyah): boolean {
    const r = this.selectedRange();
    if (!r) return false;
    return a.surah === r.surah && a.ayah >= r.startAyah && a.ayah <= r.endAyah;
  }

  protected markOf(a: QuranAyah): AyahMark | null {
    return this.marks()?.get(ayahKey(a.surah, a.ayah)) ?? null;
  }

  protected markColor(a: QuranAyah): string | null {
    const mark = this.markOf(a);
    return mark ? `var(--t-${mark.color ?? 'slate'})` : null;
  }

  protected isAyahPlaying(a: QuranAyah): boolean {
    const p = this.playingAyah();
    return !!p && p.surah === a.surah && p.ayah === a.ayah;
  }

  protected selectAyah(a: QuranAyah, event: MouseEvent) {
    event.stopPropagation();
    const el = event.currentTarget as HTMLElement;
    this.ayahClicked.emit({
      ayah: a,
      pageAyahs: this.data()?.ayahs ?? [a],
      page: this.page(),
    });
    // The selection toolbar rises from the bottom; lift the tapped ayah above it.
    requestAnimationFrame(() => this.reveal(el, 240));
  }

  protected readonly blocks = computed<Block[]>(() => {
    const blocks: Block[] = [];
    for (const a of this.data()?.ayahs ?? []) {
      if (a.ayah === 1) blocks.push({ kind: 'header', surah: a.surah, basmala: a.surah !== 1 && a.surah !== 9 });
      const last = blocks.at(-1);
      if (last?.kind === 'text') last.ayahs.push(a);
      else blocks.push({ kind: 'text', ayahs: [a] });
    }
    return blocks;
  });

  constructor() {
    effect(() => this.load(this.page()));
    // Keep the ayah being recited in view on long pages or large font sizes.
    effect(() => {
      if (!this.playingAyah() || !this.data()) return;
      requestAnimationFrame(() => {
        const el = this.host.nativeElement.querySelector<HTMLElement>('.ayah-unit.playing');
        if (el) this.reveal(el, 160);
      });
    });

    effect(() => {
      if (this.data()) afterNextRender(() => this.fit(), { injector: this.injector });
    });
    afterNextRender(() => {
      const slide = this.host.nativeElement.closest<HTMLElement>('.slide');
      if (!slide) return;
      // Border box only: the extra scroll room added for toolbars must not re-fit the text.
      let last = '';
      const observer = new ResizeObserver(([entry]) => {
        const size = `${Math.round(entry.borderBoxSize[0].inlineSize)}x${Math.round(entry.borderBoxSize[0].blockSize)}`;
        if (size !== last && last) this.fit();
        last = size;
      });
      observer.observe(slide, { box: 'border-box' });
      document.fonts?.ready.then(() => this.fit());
      this.injector.get(DestroyRef).onDestroy(() => observer.disconnect());
    });
  }

  /** Scroll the page so `el` sits clear of the top bar and of `bottomClearance` px at the bottom. */
  private reveal(el: HTMLElement, bottomClearance: number) {
    const scroller = this.host.nativeElement.closest<HTMLElement>('.slide');
    if (!scroller) return;
    const view = scroller.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (box.top >= view.top + 90 && box.bottom <= view.bottom - bottomClearance) return;
    scroller.scrollBy({ top: box.top - view.top - view.height * 0.3, behavior: 'smooth' });
  }

  /** Largest text size (within FIT_MIN..FIT_MAX, at 100% zoom) whose page fits the visible height. */
  private fit() {
    const host = this.host.nativeElement;
    const slide = host.closest<HTMLElement>('.slide');
    const sheet = host.querySelector<HTMLElement>('.sheet');
    if (!slide || !sheet || !this.data()) return;
    const cs = getComputedStyle(slide);
    const available = slide.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (available <= 0) return;

    const scrollTop = slide.scrollTop;
    const margins = parseFloat(getComputedStyle(sheet).marginTop) * 2;
    host.style.setProperty('--scale', '1');
    sheet.style.minHeight = '0';
    const fits = (f: number) => {
      host.style.setProperty('--fit', f.toFixed(3));
      return sheet.offsetHeight + margins <= available;
    };

    let best = FIT_MIN;
    if (fits(FIT_MAX)) best = FIT_MAX;
    else if (fits(FIT_MIN)) {
      let hi = FIT_MAX;
      for (let i = 0; i < 7; i++) {
        const mid = (best + hi) / 2;
        if (fits(mid)) best = mid;
        else hi = mid;
      }
    }

    host.style.setProperty('--fit', best.toFixed(3));
    sheet.style.minHeight = '';
    host.style.setProperty('--scale', String(this.fontScale()));
    slide.scrollTop = scrollTop;
    host.classList.add('fitted');
  }

  protected load(page = this.page()) {
    this.failed.set(false);
    this.data.set(null);
    this.pages.get(page).then(
      (d) => page === this.page() && this.data.set(d),
      () => page === this.page() && this.failed.set(true),
    );
  }
}
