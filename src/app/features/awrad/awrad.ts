import { ChangeDetectionStrategy, Component, computed, effect, HostListener, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AdhkarCategory,
  BUILTIN_ADHKAR,
  calcDashArray,
  DEFAULT_DHIKR_SEQUENCE,
  DhikrItem,
  getNextDhikr,
} from '../../core/awrad/awrad-data';
import { ar, counted, PASSAGES } from '../../core/format';
import { AdhkarToday } from '../../core/awrad/adhkar-today';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { AwradStore } from '../../core/awrad/awrad.store';

/** Pause on a full ring before moving to the next dhikr, so the 33rd tap is felt and seen. */
const COMPLETE_HOLD_MS = 650;

@Component({
  selector: 'app-awrad',
  imports: [Icon, Sheet, RouterLink, NgTemplateOutlet],
  templateUrl: './awrad.html',
  styleUrl: './awrad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Awrad {
  protected readonly ar = ar;
  protected readonly passages = (n: number) => (n ? counted(n, PASSAGES) : 'لا مقاطع بعد');
  protected readonly awradStore = inject(AwradStore);

  // Tasbeeh
  readonly currentDhikr = signal<DhikrItem>(DEFAULT_DHIKR_SEQUENCE[0]);
  readonly count = signal<number>(0);
  readonly totalTasbeeh = signal<number>(0);
  readonly isPulsing = signal<boolean>(false);
  /** True for the short moment a dhikr's ring is full, before the next one starts. */
  readonly completing = signal(false);
  readonly dhikrOptions = DEFAULT_DHIKR_SEQUENCE;

  // Progress rings
  readonly mobileDashArray = computed(() =>
    calcDashArray(this.count(), this.currentDhikr().target, 72)
  );

  readonly desktopDashArray = computed(() =>
    calcDashArray(this.count(), this.currentDhikr().target, 116)
  );

  // Adhkar
  private readonly adhkarToday = inject(AdhkarToday);
  readonly adhkarCategories = signal<readonly AdhkarCategory[]>(BUILTIN_ADHKAR);
  readonly activeAdhkar = signal<AdhkarCategory | null>(null);
  readonly adhkarSheetOpen = signal<boolean>(false);
  protected readonly periodNow = this.adhkarToday.periodNow();
  /** Adhkar categories completed today, remembered on this device. */
  readonly doneToday = this.adhkarToday.doneToday;
  /** `/awrad?open=morning` (from the home screen) opens that adhkar straight away. */
  readonly open = input<string>();
  /** The adhkar whose time it is comes first. */
  protected readonly sortedAdhkar = computed(() =>
    [...this.adhkarCategories()].sort((a, b) => Number(b.id === this.periodNow) - Number(a.id === this.periodNow)),
  );

  constructor() {
    effect(() => {
      const id = this.open();
      const cat = BUILTIN_ADHKAR.find((c) => c.id === id);
      if (cat) untracked(() => this.openAdhkar(cat));
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space' && !this.adhkarSheetOpen()) {
      e.preventDefault();
      this.increment();
    }
  }

  increment() {
    if (this.completing()) return;
    // Haptic feedback if available on mobile
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }

    // Trigger brief pulse animation
    this.isPulsing.set(true);
    setTimeout(() => this.isPulsing.set(false), 120);

    const nextVal = this.count() + 1;
    this.totalTasbeeh.update((t) => t + 1);

    if (nextVal >= this.currentDhikr().target) {
      // Show the full ring, then move to the next dhikr automatically (33 -> 33 -> 34)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([30, 40, 30]);
      }
      this.count.set(nextVal);
      this.completing.set(true);
      setTimeout(() => {
        this.currentDhikr.set(getNextDhikr(this.currentDhikr().id));
        this.count.set(0);
        this.completing.set(false);
      }, COMPLETE_HOLD_MS);
    } else {
      this.count.set(nextVal);
    }
  }

  reset() {
    this.count.set(0);
  }

  selectDhikr(dhikr: DhikrItem) {
    this.currentDhikr.set(dhikr);
    this.count.set(0);
  }

  // Adhkar management
  openAdhkar(category: AdhkarCategory) {
    // Already finished today: show it as finished rather than starting from zero.
    if (this.doneToday().has(category.id)) {
      const currentCounts = this.adhkarToday.countsToday();
      this.adhkarToday.saveCounts({
        ...currentCounts,
        ...Object.fromEntries(category.items.map((i) => [i.id, i.targetRepeat])),
      });
    }
    this.activeAdhkar.set(category);
    this.adhkarSheetOpen.set(true);
    
    // Auto-scroll to the first unfinished dhikr
    setTimeout(() => {
      if (typeof document === 'undefined') return;
      const counts = this.adhkarToday.countsToday();
      const firstUnfinished = category.items.find(i => (counts[i.id] || 0) < i.targetRepeat);
      if (firstUnfinished) {
        const el = document.getElementById('dhikr-' + firstUnfinished.id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  }

  closeAdhkar() {
    this.adhkarSheetOpen.set(false);
  }

  incrementAdhkar(itemId: string, target: number) {
    const counts = this.adhkarToday.countsToday();
    const cur = counts[itemId] ?? 0;
    if (cur < target) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
      this.adhkarToday.saveCounts({ ...counts, [itemId]: cur + 1 });
      this.checkAdhkarDone();
    }
  }

  private checkAdhkarDone() {
    const cat = this.activeAdhkar();
    if (!cat || this.doneToday().has(cat.id)) return;
    if (!cat.items.every((i) => this.getAdhkarCount(i.id) >= i.targetRepeat)) return;
    this.adhkarToday.markDone(cat.id);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([20, 60, 20, 60, 40]);
  }

  getAdhkarCount(id: string): number {
    return this.adhkarToday.countsToday()[id] || 0;
  }
}
