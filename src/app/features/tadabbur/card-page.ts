import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ar, AYAHS, counted, dayMonth } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import { TafsirService } from '../../core/quran/tafsir.service';
import {
  ayahKey,
  CardAyah,
  REFLECTION_PROMPTS,
  THEME_COLORS,
  ThemeColor,
} from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { labelOf } from './reflection-sheet';

const SAVE_MS = 500;

/**
 * A tadabbur card on its own page, for reading and reflecting without distraction: its ayahs one under
 * the other, each with a way to its exact place in the mushaf and its tafsir, then the reader's own words.
 */
@Component({
  selector: 'app-card-page',
  imports: [Icon, FormsModule, RouterLink],
  templateUrl: './card-page.html',
  styleUrl: './card-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardPage {
  protected readonly store = inject(TadabburStore);
  private readonly tafsirService = inject(TafsirService);
  private readonly router = inject(Router);

  /** From the route: `/tadabbur/:id`. */
  readonly id = input<string>();

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly key = ayahKey;
  protected readonly prompts = REFLECTION_PROMPTS;
  protected readonly colors = THEME_COLORS;

  protected readonly card = computed(() => this.store.get(this.id() ?? null));
  /** What the card is called when it has no title of its own: where its ayahs are. */
  protected readonly placeholder = computed(() => {
    const r = this.card();
    return r ? labelOf({ title: '', ayahs: r.ayahs }) : '';
  });
  protected readonly meta = computed(() => {
    const r = this.card();
    return r ? `${counted(r.ayahs.length, AYAHS)}، أُنشئت ${dayMonth(r.createdAt)}` : '';
  });
  protected readonly color = computed(() => {
    const r = this.card();
    const theme = r && this.store.themes().find((t) => r.themes.includes(t.id));
    return `var(--t-${theme?.color ?? 'green'})`;
  });

  protected readonly title = signal('');
  protected readonly note = signal('');
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Tafsir per ayah (`surah:ayah`): open or not, and its text once loaded. */
  protected readonly tafsirOpen = signal<ReadonlySet<string>>(new Set());
  protected readonly tafsir = signal<ReadonlyMap<string, string>>(new Map());

  /** The ayah just taken off, offered back for a few seconds. */
  protected readonly undoAyah = signal<CardAyah | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly adding = signal(false);
  protected readonly newColor = signal<ThemeColor>('teal');
  newName = '';

  constructor() {
    // Each card starts from what is stored for it.
    effect(() => {
      const id = this.id() ?? null;
      untracked(() => {
        const stored = this.store.get(id);
        this.title.set(stored?.title ?? '');
        this.note.set(stored?.note ?? '');
      });
    });
    inject(DestroyRef).onDestroy(() => {
      this.commit();
      if (this.undoTimer) clearTimeout(this.undoTimer);
    });
  }

  // ── Ayahs ─────────────────────────────────────────────────────────────

  /** To the ayah's own page in the mushaf, lit there, with a way back to this card. */
  protected openInMushaf(a: CardAyah) {
    const r = this.card();
    this.commit();
    this.store.setActive(true);
    void this.router.navigate(['/quran'], {
      queryParams: { page: a.page, ayah: ayahKey(a.surah, a.ayah), card: r?.id },
    });
  }

  protected isTafsirOpen(a: CardAyah) {
    return this.tafsirOpen().has(ayahKey(a.surah, a.ayah));
  }

  protected tafsirOf(a: CardAyah) {
    return this.tafsir().get(ayahKey(a.surah, a.ayah)) ?? null;
  }

  protected toggleTafsir(a: CardAyah) {
    const k = ayahKey(a.surah, a.ayah);
    const open = new Set(this.tafsirOpen());
    if (open.has(k)) open.delete(k);
    else open.add(k);
    this.tafsirOpen.set(open);
    if (!open.has(k) || this.tafsir().has(k)) return;
    this.tafsirService.getTafsir(a.surah, a.ayah).then((text) => {
      this.tafsir.set(new Map(this.tafsir()).set(k, text));
    });
  }

  /** Takes one ayah off the card; the last one takes the card with it (the journal offers undo). */
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
  }

  protected restoreAyah() {
    const a = this.undoAyah();
    const r = this.card();
    if (a && r) this.store.addAyahs(r.id, [a]);
    this.undoAyah.set(null);
  }

  /** "إضافة آيات": to the mushaf, where the card's last ayah is, gathering for this card. */
  protected gatherMore() {
    const r = this.card();
    if (!r) return;
    this.commit();
    this.store.addTo(r.id);
    void this.router.navigate(['/quran'], { queryParams: { page: r.ayahs.at(-1)?.page ?? 1 } });
  }

  // ── Themes ────────────────────────────────────────────────────────────

  protected hasTheme(themeId: string) {
    return this.card()?.themes.includes(themeId) ?? false;
  }

  protected toggleTheme(themeId: string) {
    const r = this.card();
    if (r) this.store.toggleTheme(r.id, themeId);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8);
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

  // ── Title and note ────────────────────────────────────────────────────

  protected onTitle(value: string) {
    this.title.set(value);
    this.schedule();
  }

  protected onNote(value: string) {
    this.note.set(value);
    this.schedule();
  }

  /** Starts a line with the question and puts the caret after it. */
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

  protected deleteCard() {
    this.cancelSave();
    const r = this.card();
    const removed = r ? this.store.remove(r.id) : null;
    void this.router.navigate(['/tadabbur'], { state: removed ? { removed } : undefined });
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
