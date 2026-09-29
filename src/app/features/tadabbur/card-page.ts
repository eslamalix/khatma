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
import { ar, AYAHS, counted, countedGenitive, dayMonth, SURAHS } from '../../core/format';
import { surahName } from '../../core/quran/quran-meta';
import { TafsirService } from '../../core/quran/tafsir.service';
import {
  ayahKey,
  CardAyah,
  formatAyahRange,
  Passage,
  passagesOf,
  REFLECTION_PROMPTS,
  reflectionsAsText,
  THEME_COLORS,
  ThemeColor,
} from '../../core/tadabbur/tadabbur';
import { TadabburStore } from '../../core/tadabbur/tadabbur.store';
import { Icon } from '../../ui/icon';
import { labelOf } from './reflection-sheet';

const SAVE_MS = 500;

/**
 * A tadabbur card on its own page, made for reading first. Consecutive ayahs read as one passage, and
 * each passage offers two things: its place in the mushaf (lit there) and its tafsir, ayah by ayah (a tap
 * on an ayah opens its own). Changing the card (taking ayahs off, themes) is there when asked for, out of
 * the way otherwise. The reader's words come last, after the ayahs.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** From the route: `/tadabbur/:id`. */
  readonly id = input<string>();

  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');
  private readonly titleField = viewChild<ElementRef<HTMLInputElement>>('titleField');

  protected readonly ar = ar;
  protected readonly surahName = surahName;
  protected readonly key = ayahKey;
  protected readonly prompts = REFLECTION_PROMPTS;
  protected readonly colors = THEME_COLORS;

  protected readonly card = computed(() => this.store.get(this.id() ?? null));
  protected readonly passages = computed(() => passagesOf(this.card()?.ayahs ?? []));
  /** What the card is called when it has no title of its own: where its ayahs are. */
  protected readonly placeholder = computed(() => {
    const r = this.card();
    return r ? labelOf({ title: '', ayahs: r.ayahs }) : '';
  });
  protected readonly meta = computed(() => {
    const r = this.card();
    if (!r) return '';
    const surahs = new Set(r.ayahs.map((a) => a.surah)).size;
    const where = surahs > 1 ? ` في ${countedGenitive(surahs, SURAHS)}` : '';
    return `${counted(r.ayahs.length, AYAHS)}${where}، ${dayMonth(r.createdAt)}`;
  });
  protected readonly cardThemes = computed(() => {
    const r = this.card();
    return r ? this.store.themes().filter((t) => r.themes.includes(t.id)) : [];
  });
  protected readonly color = computed(() => `var(--t-${this.cardThemes()[0]?.color ?? 'green'})`);

  protected readonly title = signal('');
  protected readonly note = signal('');
  protected readonly saveState = signal<'idle' | 'saving' | 'saved'>('idle');
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Passages (`surah:from`) whose tafsir is open, the tafsir loaded so far, and the ayah tapped last. */
  protected readonly tafsirOpen = signal<ReadonlySet<string>>(new Set());
  protected readonly tafsir = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly activeAyah = signal<string | null>(null);

  /** Editing: themes picker, taking ayahs off. Both closed while reading. */
  protected readonly editingThemes = signal(false);
  protected readonly editingAyahs = signal(false);
  protected readonly undoAyah = signal<CardAyah | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly adding = signal(false);
  protected readonly newColor = signal<ThemeColor>('teal');
  newName = '';

  protected readonly flash = signal<string | null>(null);
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

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
      for (const t of [this.undoTimer, this.flashTimer]) if (t) clearTimeout(t);
    });
  }

  // ── Passages ──────────────────────────────────────────────────────────

  protected passageKey(p: Passage) {
    return ayahKey(p.surah, p.from);
  }

  protected passageLabel(p: Passage) {
    const range = p.from === p.to ? ar(p.from) : `${ar(p.from)}–${ar(p.to)}`;
    return `${surahName(p.surah)} ${range}`;
  }

  /** To the passage's page in the mushaf, lit there, with a way back to this card. */
  protected openInMushaf(p: Passage) {
    const r = this.card();
    this.commit();
    this.store.setActive(true);
    void this.router.navigate(['/quran'], {
      queryParams: { page: p.page, ayah: formatAyahRange(p), card: r?.id },
    });
  }

  protected isTafsirOpen(p: Passage) {
    return this.tafsirOpen().has(this.passageKey(p));
  }

  protected tafsirOf(a: CardAyah) {
    return this.tafsir().get(ayahKey(a.surah, a.ayah)) ?? null;
  }

  protected toggleTafsir(p: Passage) {
    const open = new Set(this.tafsirOpen());
    const k = this.passageKey(p);
    if (open.delete(k)) {
      this.tafsirOpen.set(open);
      if (p.ayahs.some((a) => ayahKey(a.surah, a.ayah) === this.activeAyah()))
        this.activeAyah.set(null);
      return;
    }
    this.tafsirOpen.set(open.add(k));
    this.loadTafsir(p);
  }

  /** A tap on an ayah opens the tafsir of that ayah, under its passage. */
  protected onAyah(p: Passage, a: CardAyah) {
    if (this.editingAyahs()) return;
    const k = ayahKey(a.surah, a.ayah);
    if (this.activeAyah() === k) {
      this.activeAyah.set(null);
      return;
    }
    this.activeAyah.set(k);
    if (!this.isTafsirOpen(p)) {
      this.tafsirOpen.set(new Set(this.tafsirOpen()).add(this.passageKey(p)));
      this.loadTafsir(p);
    }
    setTimeout(() =>
      this.host.nativeElement
        .querySelector(`[data-tafsir="${k}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  }

  private loadTafsir(p: Passage) {
    for (const a of p.ayahs) {
      const k = ayahKey(a.surah, a.ayah);
      if (this.tafsir().has(k)) continue;
      this.tafsirService.getTafsir(a.surah, a.ayah).then((text) => {
        this.tafsir.set(new Map(this.tafsir()).set(k, text));
      });
    }
  }

  // ── Changing the ayahs ────────────────────────────────────────────────

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

  protected doneThemes() {
    this.adding.set(false);
    this.editingThemes.set(false);
  }

  // ── Title, note, sharing ──────────────────────────────────────────────

  protected editTitle() {
    this.titleField()?.nativeElement.focus();
  }

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

  /** The card as text (title, ayahs with their references, the reflection): shared, or copied. */
  protected async share() {
    this.commit();
    const r = this.card();
    if (!r) return;
    const text = reflectionsAsText([r], surahName, ar);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      this.showFlash('نُسخت البطاقة');
    } catch (e) {
      if ((e as DOMException)?.name !== 'AbortError') this.showFlash('تعذّرت المشاركة');
    }
  }

  protected deleteCard() {
    this.cancelSave();
    const r = this.card();
    const removed = r ? this.store.remove(r.id) : null;
    void this.router.navigate(['/tadabbur'], { state: removed ? { removed } : undefined });
  }

  private showFlash(text: string) {
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flash.set(text);
    this.flashTimer = setTimeout(() => this.flash.set(null), 2200);
  }

  private schedule() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveState.set('saving');
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
    if (this.saveState() === 'saving') this.saveState.set('saved');
  }
}
