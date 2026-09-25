import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ar, AYAHS, counted, dayMonth } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import { TafsirService } from '../../core/quran/tafsir.service';
import {
  CardAyah,
  cardLabel,
  Reflection,
  REFLECTION_PROMPTS,
  THEME_COLORS,
  ThemeColor,
} from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

const SAVE_MS = 500;
const TAFSIR_MAX_AYAHS = 10;

export const labelOf = (r: Pick<Reflection, 'title' | 'ayahs'>) => cardLabel(r, surahName, ar);

/**
 * The tadabbur card: its ayahs (any of which can be taken off), the themes it belongs to, and the
 * reader's own words about it. "إضافة آيات" sends the reader back to the mushaf to gather more.
 */
@Component({
  selector: 'app-reflection-sheet',
  imports: [Sheet, Icon, FormsModule],
  templateUrl: './reflection-sheet.html',
  styleUrl: './reflection-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReflectionSheet {
  protected readonly store = inject(TadabburStore);
  private readonly tafsirService = inject(TafsirService);

  readonly open = input(false);
  readonly reflectionId = input<string | null>(null);
  /** From the journal: offer to open the ayahs in the mushaf. */
  readonly showMushafLink = input(false);
  readonly closed = output<void>();
  readonly removed = output<{ reflection: Reflection; index: number }>();
  readonly openInMushaf = output<Reflection>();
  readonly addAyahs = output<Reflection>();

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly prompts = REFLECTION_PROMPTS;
  protected readonly colors = THEME_COLORS;

  protected readonly card = computed(() => this.store.get(this.reflectionId()));
  protected readonly heading = computed(() => {
    const r = this.card();
    return r ? labelOf({ title: '', ayahs: r.ayahs }) : 'بطاقة تدبّر';
  });
  protected readonly meta = computed(() => {
    const r = this.card();
    return r ? `${counted(r.ayahs.length, AYAHS)}، أُنشئت ${dayMonth(r.createdAt)}` : '';
  });

  protected readonly title = signal('');
  protected readonly note = signal('');
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** The ayah just taken off, offered back for a few seconds. */
  protected readonly undoAyah = signal<CardAyah | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly adding = signal(false);
  protected readonly newColor = signal<ThemeColor>('teal');
  newName = '';

  protected readonly tafsirOpen = signal(false);
  protected readonly tafsir = signal<{ ref: string; text: string }[] | null>(null);

  constructor() {
    // Each time the card opens it starts from what is stored for it.
    effect(() => {
      if (!this.open()) return;
      const id = this.reflectionId();
      untracked(() => {
        const r = this.store.get(id);
        this.title.set(r?.title ?? '');
        this.note.set(r?.note ?? '');
        this.adding.set(false);
        this.tafsirOpen.set(false);
        this.tafsir.set(null);
        this.undoAyah.set(null);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.commit();
      if (this.undoTimer) clearTimeout(this.undoTimer);
    });
  }

  protected hasTheme(themeId: string) {
    return this.card()?.themes.includes(themeId) ?? false;
  }

  protected toggleTheme(themeId: string) {
    const id = this.reflectionId();
    if (id) this.store.toggleTheme(id, themeId);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
  }

  protected onTitle(value: string) {
    this.title.set(value);
    this.schedule();
  }

  protected onNote(value: string) {
    this.note.set(value);
    this.schedule();
  }

  /** Starts a line with the question and puts the caret after it, written straight into the field so typing can follow at once. */
  protected addPrompt(prompt: string) {
    const field = this.noteField()?.nativeElement;
    const cur = (field?.value ?? this.note()).trimEnd();
    const next = cur ? `${cur}\n\n${prompt}\n` : `${prompt}\n`;
    if (field) {
      field.value = next;
      field.focus();
      field.setSelectionRange(next.length, next.length);
    }
    this.note.set(next);
    this.commit();
  }

  /** Takes one ayah off the card; the last one takes the card with it (the host offers undo). */
  protected removeAyah(a: CardAyah) {
    const r = this.card();
    if (!r) return;
    if (r.ayahs.length === 1) {
      this.deleteCard();
      return;
    }
    this.store.removeAyah(r.id, a.surah, a.ayah);
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoAyah.set(a);
    this.undoTimer = setTimeout(() => this.undoAyah.set(null), 5000);
    this.tafsir.set(null);
    this.tafsirOpen.set(false);
  }

  protected restoreAyah() {
    const a = this.undoAyah();
    const id = this.reflectionId();
    if (a && id) this.store.addAyahs(id, [a]);
    this.undoAyah.set(null);
  }

  protected startNewTheme() {
    const used = new Set(this.store.themes().map((t) => t.color));
    this.newColor.set(THEME_COLORS.find((c) => !used.has(c)) ?? 'slate');
    this.newName = '';
    this.adding.set(true);
  }

  protected confirmNewTheme() {
    const name = this.newName.trim();
    if (!name) return;
    const theme = this.store.addTheme(name, this.newColor());
    this.adding.set(false);
    this.toggleTheme(theme.id);
  }

  protected toggleTafsir() {
    const opening = !this.tafsirOpen();
    this.tafsirOpen.set(opening);
    const r = this.card();
    if (!opening || !r || this.tafsir()) return;
    const ayahs = r.ayahs.slice(0, TAFSIR_MAX_AYAHS);
    Promise.all(ayahs.map((a) => this.tafsirService.getTafsir(a.surah, a.ayah))).then((texts) =>
      this.tafsir.set(
        ayahs.map((a, i) => ({ ref: `${surahName(a.surah)} ${ar(a.ayah)}`, text: texts[i] })),
      ),
    );
  }

  protected close() {
    this.commit();
    this.closed.emit();
  }

  protected deleteCard() {
    this.cancelSave();
    const id = this.reflectionId();
    const removed = id ? this.store.remove(id) : null;
    if (removed) this.removed.emit(removed);
    this.closed.emit();
  }

  protected goToMushaf() {
    const r = this.card();
    this.close();
    if (r) this.openInMushaf.emit(r);
  }

  protected gatherMore() {
    const r = this.card();
    this.close();
    if (r) this.addAyahs.emit(r);
  }

  private schedule() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.commit(), SAVE_MS);
  }

  private cancelSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
  }

  private commit() {
    this.cancelSave();
    const r = this.card();
    if (!r) return;
    const change: { title?: string; note?: string } = {};
    if (r.title !== this.title()) change.title = this.title();
    if (r.note !== this.note()) change.note = this.note();
    if (Object.keys(change).length) this.store.update(r.id, change);
  }
}
