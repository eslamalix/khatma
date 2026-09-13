/**
 * Measures active reading time per page. Framework-free so the rules can be tested exactly.
 *
 * Rules (docs/DECISIONS.md P3):
 * - time counts only while the page is open, the app is visible and the reader is not idle;
 * - after `idleMs` without any interaction counting stops, and only `idleCreditMs` of the silent
 *   stretch is credited (someone reading a long page without touching the screen still gets their time);
 * - visits shorter than `minMs` are dropped.
 */

export interface TimingConfig {
  idleMs: number;
  idleCreditMs: number;
  minMs: number;
}

export const DEFAULT_TIMING: TimingConfig = { idleMs: 3 * 60_000, idleCreditMs: 90_000, minMs: 10_000 };

export interface PageVisit {
  page: number;
  startAt: number;
  endAt: number;
  durationMs: number;
}

export class TimingEngine {
  private page: number | null = null;
  private startAt = 0;
  private endAt = 0;
  private accumulated = 0;
  /** Start of the currently counting stretch, or null when paused. */
  private segmentStart: number | null = null;
  private lastActivity = 0;
  private visible = true;
  private idle = false;

  constructor(
    private readonly onVisit: (visit: PageVisit) => void,
    private readonly config: TimingConfig = DEFAULT_TIMING,
    private readonly now: () => number = Date.now,
  ) {}

  get currentPage() {
    return this.page;
  }

  /** Switch to a page (flushes the previous one). */
  open(page: number) {
    if (page === this.page) return this.activity();
    this.flush();
    const t = this.now();
    this.page = page;
    this.startAt = t;
    this.endAt = t;
    this.accumulated = 0;
    this.lastActivity = t;
    this.idle = false;
    this.segmentStart = this.visible ? t : null;
  }

  /** Leave the reader (flushes the current page). */
  close() {
    this.flush();
    this.page = null;
  }

  activity() {
    const t = this.now();
    this.lastActivity = t;
    if (this.page === null) return;
    if (this.idle) {
      this.idle = false;
      if (this.visible) this.segmentStart = t;
    }
  }

  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    if (!visible) this.pause(this.now());
    this.visible = visible;
    if (visible) {
      this.idle = false;
      this.lastActivity = this.now();
      if (this.page !== null) this.segmentStart = this.lastActivity;
    }
  }

  /** Call periodically (e.g. every second) to detect idleness. */
  tick() {
    if (this.segmentStart === null || this.idle) return;
    const t = this.now();
    if (t - this.lastActivity < this.config.idleMs) return;
    const credited = Math.max(this.lastActivity, this.segmentStart) + this.config.idleCreditMs;
    this.pause(Math.min(t, credited));
    this.idle = true;
  }

  /** Active time on the current page so far. */
  elapsedMs(): number {
    return this.accumulated + (this.segmentStart === null ? 0 : this.now() - this.segmentStart);
  }

  private pause(at: number) {
    if (this.segmentStart === null) return;
    const counted = Math.max(0, at - this.segmentStart);
    this.accumulated += counted;
    if (counted > 0) this.endAt = at;
    this.segmentStart = null;
  }

  private flush() {
    if (this.page === null) return;
    this.tick();
    this.pause(this.now());
    if (this.accumulated >= this.config.minMs) {
      this.onVisit({ page: this.page, startAt: this.startAt, endAt: this.endAt, durationMs: this.accumulated });
    }
    this.accumulated = 0;
  }
}
