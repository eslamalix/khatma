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
import { ar, dayMonth } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import { TafsirService } from '../../core/quran/tafsir.service';
import {
  Reflection,
  REFLECTION_PROMPTS,
  ReflectionDraft,
  THEME_COLORS,
  ThemeColor,
} from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

const NOTE_SAVE_MS = 500;
const TAFSIR_MAX_AYAHS = 10;

export const rangeLabel = (r: Pick<Reflection, 'surah' | 'from' | 'to'>) =>
  r.from === r.to
    ? `${surahName(r.surah)}، الآية ${ar(r.from)}`
    : `${surahName(r.surah)}، الآيات ${ar(r.from)}–${ar(r.to)}`;

/**
 * The reflection card: the ayah, the themes it belongs to, and the reader's own words about it.
 * Opened on a saved reflection (`reflectionId`) or on a `draft` that is only stored once something is
 * added to it, so opening and closing a card never leaves an empty entry behind.
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
  readonly draft = input<ReflectionDraft | null>(null);
  /** From the journal: offer to open the ayah in the mushaf. */
  readonly showMushafLink = input(false);
  readonly closed = output<void>();
  readonly removed = output<{ reflection: Reflection; index: number }>();
  readonly openInMushaf = output<Reflection>();

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  protected readonly ar = ar;
  protected readonly prompts = REFLECTION_PROMPTS;
  protected readonly colors = THEME_COLORS;

  private readonly id = signal<string | null>(null);
  protected readonly reflection = computed(() => this.store.get(this.id()));
  protected readonly subject = computed<ReflectionDraft | null>(
    () => this.reflection() ?? this.draft(),
  );
  protected readonly title = computed(() => {
    const s = this.subject();
    return s ? rangeLabel(s) : 'تدبّر';
  });
  protected readonly ayahs = computed(() => this.subject()?.text.split(' ۝ ') ?? []);
  protected readonly created = computed(() => {
    const r = this.reflection();
    return r ? `أُضيفت ${dayMonth(r.createdAt)}` : '';
  });

  protected readonly note = signal('');
  private noteTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly adding = signal(false);
  protected readonly newColor = signal<ThemeColor>('teal');
  newName = '';

  protected readonly tafsirOpen = signal(false);
  protected readonly tafsir = signal<{ ayah: number; text: string }[] | null>(null);

  constructor() {
    // Each time the card opens it starts from what is stored for it.
    effect(() => {
      if (!this.open()) return;
      const id = this.reflectionId();
      untracked(() => {
        this.id.set(id);
        this.note.set(this.store.get(id)?.note ?? '');
        this.adding.set(false);
        this.tafsirOpen.set(false);
        this.tafsir.set(null);
      });
    });
    inject(DestroyRef).onDestroy(() => this.commitNote());
  }

  protected hasTheme(themeId: string) {
    return this.reflection()?.themes.includes(themeId) ?? false;
  }

  protected toggleTheme(themeId: string) {
    const id = this.id();
    if (id) this.store.toggleTheme(id, themeId);
    else this.createFromDraft([themeId]);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
  }

  protected onNote(value: string) {
    this.note.set(value);
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = setTimeout(() => this.commitNote(), NOTE_SAVE_MS);
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
    this.commitNote();
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
    const s = this.subject();
    if (!opening || !s || this.tafsir()) return;
    const numbers: number[] = [];
    for (let a = s.from; a <= Math.min(s.to, s.from + TAFSIR_MAX_AYAHS - 1); a++) numbers.push(a);
    Promise.all(numbers.map((a) => this.tafsirService.getTafsir(s.surah, a))).then((texts) =>
      this.tafsir.set(numbers.map((ayah, i) => ({ ayah, text: texts[i] }))),
    );
  }

  protected close() {
    this.commitNote();
    const id = this.id();
    if (id) this.store.dropIfEmpty(id);
    this.closed.emit();
  }

  protected remove() {
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = null;
    const id = this.id();
    const removed = id ? this.store.remove(id) : null;
    this.id.set(null);
    if (removed) this.removed.emit(removed);
    this.closed.emit();
  }

  protected goToMushaf() {
    const r = this.reflection();
    this.close();
    if (r) this.openInMushaf.emit(r);
  }

  private commitNote() {
    if (this.noteTimer) clearTimeout(this.noteTimer);
    this.noteTimer = null;
    const note = this.note();
    const id = this.id();
    if (id) {
      if (this.store.get(id)?.note !== note) this.store.update(id, { note });
    } else if (note.trim() && this.open()) {
      this.createFromDraft([], note);
    }
  }

  private createFromDraft(themes: string[], note = this.note()) {
    const draft = this.draft();
    if (!draft) return;
    this.id.set(this.store.create(draft, themes, note).id);
  }
}
