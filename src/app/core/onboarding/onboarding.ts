import { Injectable, signal } from '@angular/core';

const WELCOME_KEY = 'khatma.welcome';
const TIPS_KEY = 'khatma.tips';

/** One-time help shown the first time a screen or mode is used. */
export type TipId = 'reader' | 'tadabbur';

/**
 * First-run guidance (docs/DECISIONS.md P21): a short welcome on the very first open, then one tip the
 * first time each tricky screen is used. All of it is remembered per device and can be replayed from
 * "جولة التطبيق".
 */
@Injectable({ providedIn: 'root' })
export class Onboarding {
  readonly welcomeOpen = signal(false);
  private readonly seenTips = signal<ReadonlySet<string>>(this.loadTips());

  /** Called once the reading data is loaded: somebody who has already read is not a newcomer. */
  maybeWelcome(hasHistory: boolean) {
    if (this.read(WELCOME_KEY)) return;
    if (hasHistory) {
      this.write(WELCOME_KEY, '1');
      return;
    }
    this.welcomeOpen.set(true);
  }

  finishWelcome() {
    this.welcomeOpen.set(false);
    this.write(WELCOME_KEY, '1');
  }

  /** "جولة التطبيق": the welcome again, and every tip shows once more. */
  replay() {
    this.seenTips.set(new Set());
    this.write(TIPS_KEY, '[]');
    this.welcomeOpen.set(true);
  }

  shouldShow(tip: TipId) {
    return !this.seenTips().has(tip);
  }

  dismiss(tip: TipId) {
    const next = new Set(this.seenTips()).add(tip);
    this.seenTips.set(next);
    this.write(TIPS_KEY, JSON.stringify([...next]));
  }

  private loadTips(): ReadonlySet<string> {
    try {
      const list = JSON.parse(this.read(TIPS_KEY) ?? '[]');
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private mode: the guidance just shows again next time.
    }
  }
}
