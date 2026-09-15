import { computed, Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import { ar } from '../format';
import { AyahRef, compareAyah, nextAyah, prevAyah, surahName } from './quran-meta';

export interface Reciter {
  id: string;
  name: string;
  sub: string;
  cdnUrl: string;
}

export const RECITERS: Reciter[] = [
  { id: 'alafasy', name: 'مشاري العفاسي', sub: 'مرتل', cdnUrl: 'https://everyayah.com/data/Alafasy_128kbps' },
  { id: 'husary', name: 'محمود خليل الحصري', sub: 'مرتل', cdnUrl: 'https://everyayah.com/data/Husary_128kbps' },
  { id: 'minshawy', name: 'محمد صديق المنشاوي', sub: 'مرتل', cdnUrl: 'https://everyayah.com/data/Minshawy_Murattal_128kbps' },
  { id: 'muaiqly', name: 'ماهر المعيقلي', sub: 'مرتل', cdnUrl: 'https://everyayah.com/data/MaherAlMuaiqly128kbps' },
];

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;
export const AYAH_REPEATS = [1, 2, 3, 5] as const;
export type PlaybackRate = (typeof PLAYBACK_RATES)[number];
export type AyahRepeat = (typeof AYAH_REPEATS)[number];
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/** What is being recited: `to` null means keep going until the listener stops. */
export interface PlaybackRange {
  from: AyahRef;
  to: AyahRef | null;
}

/** One step of recitation: an ayah, its repeat iteration, and whether the basmala precedes it. */
export interface PlayStep {
  ayah: AyahRef;
  iteration: number;
  basmala: boolean;
}

const PREFS_KEY = 'khatma.audio';
/** Pressing "previous" this far into an ayah restarts it instead (like every music player). */
const RESTART_THRESHOLD_S = 2.5;

const needsBasmala = ({ surah, ayah }: AyahRef) => ayah === 1 && surah !== 1 && surah !== 9;

export const firstStep = (ayah: AyahRef): PlayStep => ({ ayah, iteration: 1, basmala: needsBasmala(ayah) });

/** Decides what plays after `step` finishes. Pure, so the queue rules are unit-tested. */
export function stepAfter(
  step: PlayStep,
  range: PlaybackRange,
  repeat: number,
  loopRange: boolean,
): PlayStep | null {
  if (step.basmala) return { ...step, basmala: false };
  if (step.iteration < repeat) return { ...step, iteration: step.iteration + 1 };
  if (range.to && compareAyah(step.ayah, range.to) >= 0) return loopRange ? firstStep(range.from) : null;
  const next = nextAyah(step.ayah);
  return next ? firstStep(next) : null;
}

export function ayahAudioUrl(reciter: Reciter, { surah, ayah }: AyahRef) {
  return `${reciter.cdnUrl}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}

interface Prefs {
  reciterId: string;
  rate: PlaybackRate;
  repeat: AyahRepeat;
  at?: number;
}

/**
 * Ayah-by-ayah recitation on a single <audio> element (reliable on iOS once unlocked by a tap).
 * Keeps going across ayahs, surahs and pages; the reader follows `current` to turn pages.
 */
@Injectable({ providedIn: 'root' })
export class QuranAudioService {
  private readonly audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null;
  /** Warms the HTTP cache with the next ayah so the gap between ayahs stays short. */
  private readonly preloader: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null;
  private expectedSrc = '';

  readonly status = signal<PlayerStatus>('idle');
  readonly step = signal<PlayStep | null>(null);
  readonly range = signal<PlaybackRange | null>(null);
  readonly reciter = signal<Reciter>(RECITERS[0]);
  readonly rate = signal<PlaybackRate>(1);
  readonly repeat = signal<AyahRepeat>(1);
  readonly loopRange = signal(false);
  /** 0..1 through the current audio file. */
  readonly progress = signal(0);

  readonly current = computed(() => this.step()?.ayah ?? null);
  readonly isPlaying = computed(() => this.status() === 'playing');
  readonly isActive = computed(() => this.status() !== 'idle');
  readonly isBoundedRange = computed(() => !!this.range()?.to);

  private readonly cloud = injectOptional(CloudSync);

  constructor() {
    this.restorePrefs();
    this.cloud?.registerDoc<Prefs>({
      name: 'audio',
      read: () => ({ data: this.currentPrefs(), updatedAt: this.savedAt() }),
      apply: (data, updatedAt) => {
        this.applyPrefs(data);
        this.writePrefs(updatedAt);
      },
    });
    const a = this.audio;
    if (!a) return;
    a.preload = 'auto';
    if (this.preloader) this.preloader.preload = 'auto';
    a.addEventListener('playing', () => this.status.set('playing'));
    a.addEventListener('waiting', () => this.status() !== 'paused' && this.status.set('loading'));
    // Pauses we did not ask for (a phone call, headset unplugged). Ignored while a new source loads or at the end.
    a.addEventListener('pause', () => {
      if (a.ended || a.readyState === 0 || this.status() === 'idle') return;
      this.status.set('paused');
    });
    a.addEventListener('timeupdate', () => this.progress.set(a.duration ? a.currentTime / a.duration : 0));
    a.addEventListener('ended', () => this.onEnded());
    a.addEventListener('error', () => {
      // A stale error from a source we already replaced is not the listener's problem.
      if (a.src !== this.expectedSrc || this.status() === 'idle') return;
      this.status.set('error');
    });
    this.bindMediaSession();
  }

  /** Recite from `from`; with `to` stop (or loop) at the end of that ayah, otherwise continue onward. */
  playRange(from: AyahRef, to: AyahRef | null = null) {
    if (to && compareAyah(from, to) > 0) [from, to] = [to, from];
    this.range.set({ from, to });
    this.load(firstStep(from));
  }

  toggle() {
    const a = this.audio;
    if (!a || !this.step()) return;
    if (this.status() === 'error') return this.retry();
    if (this.status() === 'playing' || this.status() === 'loading') {
      this.status.set('paused');
      a.pause();
    } else {
      this.start();
    }
  }

  retry() {
    const s = this.step();
    if (s) this.load(s);
  }

  next() {
    const s = this.step();
    const r = this.range();
    if (!s || !r) return;
    const atEnd = r.to && compareAyah(s.ayah, r.to) >= 0;
    const target = atEnd ? (this.loopRange() ? r.from : null) : nextAyah(s.ayah);
    if (target) this.load(firstStep(target));
  }

  prev() {
    const s = this.step();
    const r = this.range();
    const a = this.audio;
    if (!s || !r || !a) return;
    const atStart = compareAyah(s.ayah, r.from) <= 0;
    const target = prevAyah(s.ayah);
    if (a.currentTime > RESTART_THRESHOLD_S || atStart || !target) {
      a.currentTime = 0;
      if (this.status() === 'paused') this.start();
      return;
    }
    this.load(firstStep(target));
  }

  stop() {
    this.audio?.pause();
    this.expectedSrc = '';
    this.status.set('idle');
    this.step.set(null);
    this.range.set(null);
    this.progress.set(0);
    this.loopRange.set(false);
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) navigator.mediaSession.metadata = null;
  }

  setReciter(id: string) {
    const found = RECITERS.find((r) => r.id === id);
    if (!found || found.id === this.reciter().id) return;
    this.reciter.set(found);
    this.savePrefs();
    const s = this.step();
    // Switch voices mid-recitation without losing the place.
    if (s && this.status() !== 'paused') this.load({ ...s, iteration: 1 });
  }

  setRate(rate: PlaybackRate) {
    this.rate.set(rate);
    if (this.audio) this.audio.defaultPlaybackRate = this.audio.playbackRate = rate;
    this.savePrefs();
  }

  setRepeat(repeat: AyahRepeat) {
    this.repeat.set(repeat);
    this.savePrefs();
  }

  /** Human label for what is playing, e.g. "البقرة، آية ٢٥٥". */
  label(step = this.step()) {
    if (!step) return '';
    return step.basmala ? `${surahName(step.ayah.surah)}، البسملة` : `${surahName(step.ayah.surah)}، آية ${ar(step.ayah.ayah)}`;
  }

  private load(step: PlayStep) {
    const a = this.audio;
    if (!a) return;
    this.step.set(step);
    this.progress.set(0);
    this.status.set('loading');
    this.expectedSrc = ayahAudioUrl(this.reciter(), step.basmala ? { surah: 1, ayah: 1 } : step.ayah);
    a.src = this.expectedSrc;
    a.defaultPlaybackRate = a.playbackRate = this.rate();
    this.updateMediaSession();
    this.start();
    this.preloadNext(step);
  }

  private start() {
    const a = this.audio;
    if (!a) return;
    const src = a.src;
    a.play().catch((err: DOMException) => {
      // AbortError: the source changed before playback began; a newer load owns the state now.
      if (err?.name === 'AbortError' || a.src !== src) return;
      this.status.set(err?.name === 'NotAllowedError' ? 'paused' : 'error');
    });
  }

  private onEnded() {
    const s = this.step();
    const r = this.range();
    if (!s || !r) return;
    const next = stepAfter(s, r, this.repeat(), this.loopRange());
    if (next) this.load(next);
    else this.stop();
  }

  private preloadNext(step: PlayStep) {
    const r = this.range();
    const next = r && stepAfter({ ...step, iteration: this.repeat() }, r, this.repeat(), this.loopRange());
    if (!next || !this.preloader) return;
    this.preloader.src = ayahAudioUrl(this.reciter(), next.basmala ? { surah: 1, ayah: 1 } : next.ayah);
  }

  /** Lock-screen / headset / notification controls on phones and desktops. */
  private bindMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => this.toggle()],
      ['pause', () => this.toggle()],
      ['nexttrack', () => this.next()],
      ['previoustrack', () => this.prev()],
      ['stop', () => this.stop()],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        // Unsupported action on this browser.
      }
    }
  }

  private updateMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: this.label(),
      artist: this.reciter().name,
      album: 'القرآن الكريم',
    });
  }

  private restorePrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
      if (saved) this.applyPrefs(saved);
    } catch {
      // Private mode or corrupt value: defaults are fine.
    }
  }

  private applyPrefs(saved: Partial<Prefs>) {
    const reciter = RECITERS.find((r) => r.id === saved.reciterId);
    if (reciter) this.reciter.set(reciter);
    if (PLAYBACK_RATES.includes(saved.rate as PlaybackRate)) {
      this.rate.set(saved.rate as PlaybackRate);
      if (this.audio) this.audio.defaultPlaybackRate = this.audio.playbackRate = this.rate();
    }
    if (AYAH_REPEATS.includes(saved.repeat as AyahRepeat)) this.repeat.set(saved.repeat as AyahRepeat);
  }

  private currentPrefs(): Prefs {
    return { reciterId: this.reciter().id, rate: this.rate(), repeat: this.repeat() };
  }

  private savedAt(): number {
    try {
      return (JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Prefs | null)?.at ?? 0;
    } catch {
      return 0;
    }
  }

  private writePrefs(at: number) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ ...this.currentPrefs(), at }));
    } catch {
      // Not persisted; the choice still applies for this session.
    }
  }

  private savePrefs() {
    this.writePrefs(Date.now());
    this.cloud?.touchDoc('audio');
  }
}
