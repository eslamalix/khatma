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
const FIT_MAX = 1.5;
/** On a wide screen a page is width-limited, so its text may grow further to fill the height. */
const FIT_MAX_WIDE = 1.9;
/** Wide screens show the whole page at once, like a printed mushaf, so the text may shrink further. */
const FIT_MIN_WIDE = 0.58;
const WIDE = 768;
/** Vertical reading on a wide screen: one page in the middle, at a comfortable size. */
const FLOW_FIT_WIDE = 1;

let quranFontLoad: Promise<unknown> | undefined;
/** Resolves when the Quran face (every part of it the pages use) is loaded; never rejects. */
const quranFont = () =>
  (quranFontLoad ??= (document.fonts
    ? Promise.all([
        document.fonts.load('28px "Amiri Quran"', 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۝١٢٣'),
        document.fonts.load('28px "Amiri Quran"', 'ٱلْحَمْدُ'),
      ]).catch(() => undefined)
    : Promise.resolve()));

/** Height of a page's blocks (headers and text), without the page number. */
const textHeight = (page: HTMLElement) => {
  let sum = 0;
  for (const el of page.querySelectorAll<HTMLElement>('.sheet > :not(.page-no)')) sum += el.offsetHeight;
  return sum;
};

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
  host: { '[style.--scale]': 'fontScale()', '[class.opening]': 'page() <= 2', '[class.flow]': 'flow()' },
})
export class MushafPage {
  private readonly pages = inject(QuranPages);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly page = input.required<number>();
  readonly fontScale = input(1);
  /** Vertical reading: pages follow one another at their own height, so the text is not fitted to the screen. */
  readonly flow = input(false);
  readonly selectedRange = input<{ surah: number; startAyah: number; endAyah: number } | null>(null);
  readonly playingAyah = input<{ surah: number; ayah: number } | null>(null);
  /** Ayahs the reader was sent to (a passage on a tadabbur card): lit and scrolled into view. */
  readonly focusAyahs = input<{ surah: number; from: number; to: number } | null>(null);
  /** Ayahs the reader marked while reflecting (keyed `surah:ayah`). */
  readonly marks = input<ReadonlyMap<string, AyahMark> | null>(null);
  /** Tadabbur mode: marks are drawn as coloured bands; otherwise only their ornament is tinted. */
  readonly markMode = input(false);
  /** Ayahs being gathered for a tadabbur card (keyed `surah:ayah`). */
  readonly collected = input<ReadonlySet<string> | null>(null);
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

  protected isCollected(a: QuranAyah): boolean {
    return this.collected()?.has(ayahKey(a.surah, a.ayah)) ?? false;
  }

  protected markColor(a: QuranAyah): string | null {
    const mark = this.markOf(a);
    return mark ? `var(--t-${mark.color ?? 'slate'})` : null;
  }

  protected isAyahPlaying(a: QuranAyah): boolean {
    const p = this.playingAyah();
    return !!p && p.surah === a.surah && p.ayah === a.ayah;
  }

  protected isAyahFocused(a: QuranAyah): boolean {
    const f = this.focusAyahs();
    return !!f && f.surah === a.surah && a.ayah >= f.from && a.ayah <= f.to;
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
      if (!this.focusAyahs() || !this.data()) return;
      // After the text has been fitted, so the ayah is scrolled to where it finally sits.
      setTimeout(() => {
        const el = this.host.nativeElement.querySelector<HTMLElement>('.ayah-unit.focused');
        if (el) this.reveal(el, 180);
      }, 350);
    });

    // Fitted again when tadabbur mode comes or goes (its strip changes the room the page has) and when the
    // reading mode changes.
    effect(() => {
      this.markMode();
      this.flow();
      if (this.data()) {
        afterNextRender(
          () => {
            this.fit();
            this.watchText();
          },
          { injector: this.injector },
        );
      }
    });
    afterNextRender(() => {
      const slide = this.host.nativeElement.closest<HTMLElement>('.slide');
      if (!slide) return;
      // The slide's box and the room inside its padding (tadabbur's strip takes some), never its scroll
      // height: the extra scroll room added under the page for toolbars must not re-fit the text.
      let last = '';
      const observer = new ResizeObserver(([entry]) => {
        const b = entry.borderBoxSize[0];
        const c = entry.contentBoxSize[0];
        const size = [b.inlineSize, b.blockSize, c.blockSize].map(Math.round).join('x');
        if (size !== last && last) this.fit();
        last = size;
      });
      observer.observe(slide, { box: 'content-box' });
      document.fonts?.ready.then(() => this.fit());
      // The Quran face is fetched when the first page is drawn, so it can arrive after `ready` has resolved;
      // sizing the text against the fallback face's metrics would leave the page half empty.
      const refit = () => this.fit();
      document.fonts?.addEventListener('loadingdone', refit);
      this.injector.get(DestroyRef).onDestroy(() => document.fonts?.removeEventListener('loadingdone', refit));
      this.injector.get(DestroyRef).onDestroy(() => observer.disconnect());
    });
  }

  /** Scroll the page so `el` sits clear of the top bar and of `bottomClearance` px at the bottom. */
  private reveal(el: HTMLElement, bottomClearance: number) {
    // Vertical reading scrolls the whole mushaf; otherwise each page scrolls on its own.
    const scroller = this.host.nativeElement.closest<HTMLElement>(this.flow() ? '.pager' : '.slide');
    if (!scroller) return;
    const view = scroller.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    if (box.top >= view.top + 90 && box.bottom <= view.bottom - bottomClearance) return;
    scroller.scrollBy({ top: box.top - view.top - view.height * 0.3, behavior: 'smooth' });
  }

  private fontReady = false;
  private textObserver?: ResizeObserver;

  /**
   * The text can change its height while the slide keeps its size (the Quran face arriving after the first
   * measure, a page drawn late in a background tab). Fit again when the blocks no longer match what the last
   * fit left them at (kept on the element, as facing pages are fitted together).
   */
  private watchText() {
    this.textObserver?.disconnect();
    this.textObserver ??= new ResizeObserver(() => {
      const host = this.host.nativeElement;
      if (Math.abs(textHeight(host) - Number(host.dataset['fittedHeight'] ?? 0)) > 2) this.fit();
    });
    for (const el of this.host.nativeElement.querySelectorAll<HTMLElement>('.sheet > :not(.page-no)')) this.textObserver.observe(el);
    this.injector.get(DestroyRef).onDestroy(() => this.textObserver?.disconnect());
  }

  /** Largest text size (within FIT_MIN..FIT_MAX, at 100% zoom) whose page fits the visible height. */
  private fit() {
    // Sized only once the Quran face has arrived: against the fallback face the text is far taller, and the
    // page would settle at the smallest size and stay half empty.
    if (!this.fontReady) {
      void quranFont().then(() => {
        this.fontReady = true;
        this.fit();
      });
      return;
    }
    const host = this.host.nativeElement;
    const slide = host.closest<HTMLElement>('.slide');
    const sheet = host.querySelector<HTMLElement>('.sheet');
    if (!slide || !sheet || !this.data()) return;
    if (this.flow()) {
      // One size for every page of the scroll: the reading size of the device, then the reader's zoom.
      host.style.setProperty('--fit', String(slide.clientWidth >= WIDE ? FLOW_FIT_WIDE : FIT_MIN));
      host.style.setProperty('--scale', String(this.fontScale()));
      host.classList.add('fitted');
      requestAnimationFrame(() => (host.dataset['fittedHeight'] = String(textHeight(host))));
      return;
    }
    const cs = getComputedStyle(slide);
    const available = slide.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (available <= 0) return;

    const scrollTop = slide.scrollTop;
    const margins = parseFloat(getComputedStyle(sheet).marginTop) * 2;
    // Measured on fresh copies of the page, never by resizing the live one: Chromium restyles the paragraph
    // at once but leaves the ayahs inside it at their old size until the next frame, so a live page measured
    // mid-search reports heights that belong to neither size, and the page settled far too small or too large.
    const probe = host.cloneNode(false) as HTMLElement;
    probe.removeAttribute('id');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = `position:absolute;top:0;left:0;width:${host.offsetWidth}px;min-height:0;visibility:hidden;pointer-events:none;--scale:1`;
    slide.append(probe);
    const fits = (f: number) => {
      probe.style.setProperty('--fit', f.toFixed(3));
      const copy = sheet.cloneNode(true) as HTMLElement;
      copy.style.flex = 'none';
      probe.replaceChildren(copy);
      return copy.offsetHeight + margins <= available;
    };

    const wide = slide.clientWidth >= WIDE;
    const min = wide ? FIT_MIN_WIDE : FIT_MIN;
    const max = wide ? FIT_MAX_WIDE : FIT_MAX;
    let best = min;
    if (fits(max)) best = max;
    else if (fits(min)) {
      let hi = max;
      for (let i = 0; i < 7; i++) {
        const mid = (best + hi) / 2;
        if (fits(mid)) best = mid;
        else hi = mid;
      }
    }
    probe.remove();

    // Facing pages share one size, the smaller of the two, so the spread reads as one mushaf.
    host.dataset['fit'] = String(best);
    const pages = [...slide.querySelectorAll<HTMLElement>('app-mushaf-page')];
    const shared = Math.min(...pages.map((p) => Number(p.dataset['fit']) || best));
    for (const p of pages) p.style.setProperty('--fit', shared.toFixed(3));
    host.style.setProperty('--scale', String(this.fontScale()));
    slide.scrollTop = scrollTop;
    host.classList.add('fitted');
    // Recorded once the new size has been drawn (see above: the ayahs follow a frame later).
    requestAnimationFrame(() => {
      for (const p of pages) p.dataset['fittedHeight'] = String(textHeight(p));
    });
  }

  protected load(page = this.page()) {
    delete this.host.nativeElement.dataset['fit'];
    this.failed.set(false);
    this.data.set(null);
    this.pages.get(page).then(
      (d) => page === this.page() && this.data.set(d),
      () => page === this.page() && this.failed.set(true),
    );
  }
}
