import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { QuranPages } from '../../core/quran/quran-pages.service';
import { QuranAyah, QuranPage } from '../../core/quran/quran-page';
import { ar } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';

type Block = { kind: 'header'; surah: number; basmala: boolean } | { kind: 'text'; ayahs: QuranAyah[] };

/** One mushaf page. Text reflows to the screen; the page's ayahs never change (Q2). */
@Component({
  selector: 'app-mushaf-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mushaf-page.html',
  styleUrl: './mushaf-page.scss',
  host: { '[style.--scale]': 'fontScale()', '[class.opening]': 'page() <= 2' },
})
export class MushafPage {
  private readonly pages = inject(QuranPages);
  readonly page = input.required<number>();
  readonly fontScale = input(1);

  protected readonly data = signal<QuranPage | null>(null);
  protected readonly failed = signal(false);
  protected readonly ar = ar;
  protected readonly surahName = surahName;

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
