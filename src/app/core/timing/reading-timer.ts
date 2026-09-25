import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ReadingStore } from '../reading/reading.store';
import { TadabburStore } from '../tadabbur/tadabbur.store';
import { PageVisit, TimingEngine } from './timing-engine';

/** Where counted time goes: the khatma, or tadabbur (its own stats and position, never the khatma's). */
export type ReadingTarget = 'khatma' | 'tadabbur';

/** A visit to a two-page spread counts half its time for each page (docs/DECISIONS.md P6). */
export function splitSpread(visit: PageVisit, partner: number | null): PageVisit[] {
  if (partner === null) return [visit];
  const half = visit.durationMs / 2;
  return [
    { ...visit, durationMs: half },
    { ...visit, page: partner, durationMs: half },
  ];
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/** Connects the timing engine to the browser (visibility, interaction, page lifecycle) and the stores. */
@Injectable({ providedIn: 'root' })
export class ReadingTimer {
  private readonly store = inject(ReadingStore);
  private readonly tadabbur = inject(TadabburStore);
  private readonly doc = inject(DOCUMENT);
  private readonly engine = new TimingEngine((visit) => this.record(visit));
  private target: ReadingTarget = 'khatma';
  /** The facing page when a spread is open; it shares the spread's time. */
  private partner: number | null = null;
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

  /** Start or move tracking to `page` (and its facing page when two are open side by side). */
  open(page: number, partner: number | null = null) {
    if (!this.interval) this.start();
    if (partner !== this.partner && this.engine.currentPage === page) this.engine.close();
    this.engine.open(page);
    this.partner = partner;
    if (this.target === 'tadabbur') this.tadabbur.setLastPage(page);
    else this.store.setLastPage(page);
  }

  /**
   * Switch where time goes. The page being read is closed off under the old target; the caller opens
   * the next page, so neither mode's saved position is overwritten by the other's.
   */
  setTarget(target: ReadingTarget) {
    if (target === this.target) return;
    this.engine.close();
    this.target = target;
  }

  private record(visit: PageVisit) {
    // The spread partner in force while this visit was counted.
    for (const v of splitSpread(visit, this.partner)) {
      if (this.target === 'tadabbur') this.tadabbur.addVisit(v);
      else void this.store.addVisit(v);
    }
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
