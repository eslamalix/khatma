import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ReadingStore } from '../reading/reading.store';
import { TimingEngine } from './timing-engine';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Connects the timing engine to the browser (visibility, interaction, page lifecycle) and the store. */
@Injectable({ providedIn: 'root' })
export class ReadingTimer {
  private readonly store = inject(ReadingStore);
  private readonly doc = inject(DOCUMENT);
  private readonly engine = new TimingEngine((visit) => this.store.addVisit(visit));
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastActivityPing = 0;

  /** Active seconds on the open page, refreshed every second while reading. */
  readonly elapsedMs = signal(0);

  private readonly onActivity = () => {
    const now = Date.now();
    if (now - this.lastActivityPing < 500) return;
    this.lastActivityPing = now;
    this.engine.activity();
  };
  private readonly onVisibility = () => this.engine.setVisible(this.doc.visibilityState === 'visible');
  private readonly onPageHide = () => this.engine.close();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Start or move tracking to `page`. */
  open(page: number) {
    if (!this.interval) this.start();
    this.engine.open(page);
    this.store.setLastPage(page);
  }

  /** Counts as interaction: following a recitation is reading even without touching the screen. */
  ping() {
    if (this.interval) this.onActivity();
  }

  stop() {
    if (!this.interval) return;
    this.engine.close();
    clearInterval(this.interval);
    this.interval = null;
    for (const e of ACTIVITY_EVENTS) this.doc.removeEventListener(e, this.onActivity, true);
    this.doc.removeEventListener('visibilitychange', this.onVisibility);
    this.doc.defaultView?.removeEventListener('pagehide', this.onPageHide);
    this.elapsedMs.set(0);
  }

  private start() {
    for (const e of ACTIVITY_EVENTS) this.doc.addEventListener(e, this.onActivity, { capture: true, passive: true });
    this.doc.addEventListener('visibilitychange', this.onVisibility);
    this.doc.defaultView?.addEventListener('pagehide', this.onPageHide);
    this.engine.setVisible(this.doc.visibilityState === 'visible');
    this.interval = setInterval(() => {
      this.engine.tick();
      this.elapsedMs.set(this.engine.elapsedMs());
    }, 1000);
  }
}
