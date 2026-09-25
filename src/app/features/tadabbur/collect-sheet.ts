import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ar, AYAHS, counted } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import { ayahsLabel, CardAyah, Reflection } from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { labelOf } from './reflection-sheet';

type Mode = 'new' | 'existing';

/**
 * "حفظ في بطاقة": the ayahs gathered in the mushaf go on a new card (with a title and themes) or on a
 * card the reader already has. Any gathered ayah can still be dropped here before saving.
 */
@Component({
  selector: 'app-collect-sheet',
  imports: [Sheet, Icon, FormsModule],
  templateUrl: './collect-sheet.html',
  styleUrl: './collect-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectSheet {
  protected readonly store = inject(TadabburStore);
  readonly open = input(false);
  readonly closed = output<void>();
  /** The card the ayahs went on. */
  readonly saved = output<Reflection>();

  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly labelOf = labelOf;
  protected readonly countLabel = (n: number) => counted(n, AYAHS);

  protected readonly mode = signal<Mode>('new');
  protected readonly themes = signal<string[]>([]);
  title = '';

  protected readonly heading = computed(
    () => `حفظ ${counted(this.store.collection().length, AYAHS)}`,
  );
  protected readonly summary = computed(() => ayahsLabel(this.store.collection(), surahName, ar));
  protected readonly cards = computed(() =>
    [...this.store.reflections()].sort((a, b) => b.updatedAt - a.updatedAt),
  );

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.mode.set('new');
        this.themes.set([]);
        this.title = '';
      });
    });
    // Nothing left to save: the sheet has no reason to stay.
    effect(() => {
      if (this.open() && !this.store.collection().length) untracked(() => this.closed.emit());
    });
  }

  protected drop(a: CardAyah) {
    this.store.uncollect(a.surah, a.ayah);
  }

  protected toggleTheme(id: string) {
    this.themes.update((list) =>
      list.includes(id) ? list.filter((t) => t !== id) : [...list, id],
    );
  }

  protected createCard() {
    const ayahs = this.store.collection();
    if (!ayahs.length) return;
    const card = this.store.create(ayahs, { title: this.title, themes: this.themes() });
    this.finish(card);
  }

  protected addToCard(card: Reflection) {
    this.store.addAyahs(card.id, this.store.collection());
    this.finish(this.store.get(card.id) ?? card);
  }

  private finish(card: Reflection) {
    this.store.clearCollection();
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([12, 40, 12]);
    this.saved.emit(card);
  }
}
