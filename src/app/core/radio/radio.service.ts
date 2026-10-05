import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { QuranAudioService } from '../quran/quran-audio.service';

export interface RadioStation {
  id: 'saudi' | 'cairo';
  /** Short name on the station button, e.g. "السعودية". */
  name: string;
  /** Where it broadcasts from, under the name, e.g. "من القاهرة". */
  place: string;
  /** Full on-air name, used for the lock screen and the now-playing bar. */
  title: string;
  /** Live MP3 streams, tried in order; later ones are backups. */
  streams: string[];
}

/**
 * Both stations are relayed through Radiojar, whose station records name them "saudi-quran-radio"
 * and "quran-radio-cairo". Verified live on 2026-10-05; the stream URLs redirect to plain http, which
 * browsers upgrade for audio, and playback from an https page was confirmed in Chromium.
 */
export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'saudi',
    name: 'السعودية',
    place: 'من المملكة',
    title: 'إذاعة القرآن الكريم من المملكة العربية السعودية',
    streams: ['https://stream.radiojar.com/0tpy1h0kxtzuv', 'https://stream.radiojar.com/4wqre23fytzuv'],
  },
  {
    id: 'cairo',
    name: 'القاهرة',
    place: 'من مصر',
    title: 'إذاعة القرآن الكريم من القاهرة',
    streams: ['https://stream.radiojar.com/8s5u5tpdtwzuv'],
  },
];

export type RadioStatus = 'idle' | 'loading' | 'playing' | 'error';

/** A stream that has not started this long after we asked is treated as failed. */
const CONNECT_TIMEOUT_MS = 15_000;

/** Index of the stream to try after `index` fails, or null when every stream has been tried. */
export function streamAfter(station: RadioStation, index: number): number | null {
  return index + 1 < station.streams.length ? index + 1 : null;
}

/**
 * Live Quran radio on its own <audio> element. Live audio has no "resume where you left off", so
 * stopping drops the connection and playing always reconnects to the live edge.
 * Radio and ayah recitation never play over each other: starting one stops the other.
 */
@Injectable({ providedIn: 'root' })
export class RadioService {
  private readonly audio: HTMLAudioElement | null = typeof Audio !== 'undefined' ? new Audio() : null;
  private readonly recitation = inject(QuranAudioService);
  private streamIndex = 0;
  private expectedSrc = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly stations = RADIO_STATIONS;
  readonly station = signal<RadioStation | null>(null);
  readonly status = signal<RadioStatus>('idle');
  readonly isActive = computed(() => this.status() !== 'idle');

  constructor() {
    const a = this.audio;
    if (a) {
      a.preload = 'none';
      a.addEventListener('playing', () => {
        clearTimeout(this.timer);
        this.status.set('playing');
      });
      a.addEventListener('waiting', () => this.status() === 'playing' && this.status.set('loading'));
      // A pause we did not ask for (a phone call, headset unplugged) ends the live session.
      a.addEventListener('pause', () => {
        const live = this.status() === 'playing' || this.status() === 'loading';
        if (live && a.src === this.expectedSrc && a.readyState > 0) this.stop();
      });
      a.addEventListener('error', () => {
        if (a.src === this.expectedSrc && this.status() !== 'idle') this.fallback();
      });
    }
    effect(() => {
      if (this.recitation.isActive() && untracked(this.isActive)) this.stop();
    });
  }

  /** Tap on a station: start it, or stop it when it is already the one on air. */
  toggle(station: RadioStation) {
    if (this.station()?.id === station.id && this.status() !== 'error' && this.isActive()) this.stop();
    else this.play(station);
  }

  play(station: RadioStation) {
    this.recitation.stop();
    this.station.set(station);
    this.streamIndex = 0;
    this.connect();
    this.bindMediaSession();
  }

  stop() {
    clearTimeout(this.timer);
    this.status.set('idle');
    this.expectedSrc = '';
    const a = this.audio;
    if (a) {
      a.pause();
      // Dropping the source closes the connection, so a stopped station uses no data.
      a.removeAttribute('src');
      a.load();
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }

  private connect() {
    const a = this.audio;
    const station = this.station();
    if (!a || !station) return;
    clearTimeout(this.timer);
    this.status.set('loading');
    this.expectedSrc = station.streams[this.streamIndex];
    a.src = this.expectedSrc;
    const src = a.src;
    // Normalised by the element, so later comparisons use what it reports.
    this.expectedSrc = src;
    this.timer = setTimeout(() => this.status() === 'loading' && this.fallback(), CONNECT_TIMEOUT_MS);
    a.play().catch((err: DOMException) => {
      if (err?.name === 'AbortError' || a.src !== src) return;
      if (err?.name === 'NotAllowedError') this.stop();
      else this.fallback();
    });
  }

  private fallback() {
    const station = this.station();
    const next = station && streamAfter(station, this.streamIndex);
    if (next === null || next === undefined) {
      clearTimeout(this.timer);
      this.status.set('error');
      this.audio?.pause();
      return;
    }
    this.streamIndex = next;
    this.connect();
  }

  /** Lock-screen and headset controls; next/previous switch station. */
  private bindMediaSession() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const station = this.station();
    if (station && typeof MediaMetadata !== 'undefined') {
      ms.metadata = new MediaMetadata({ title: station.title, artist: 'بث مباشر', album: 'إذاعة القرآن الكريم' });
    }
    const other = () => {
      const current = this.station();
      const next = this.stations.find((s) => s.id !== current?.id);
      if (next) this.play(next);
    };
    const handlers: [MediaSessionAction, (() => void) | null][] = [
      ['play', () => station && this.play(station)],
      ['pause', () => this.stop()],
      ['stop', () => this.stop()],
      ['nexttrack', other],
      ['previoustrack', other],
    ];
    for (const [action, fn] of handlers) {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        // Unsupported action on this browser.
      }
    }
  }
}
