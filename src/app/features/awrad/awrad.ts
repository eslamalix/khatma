import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import {
  AdhkarCategory,
  AyahGroup,
  BUILTIN_ADHKAR,
  calcDashArray,
  DEFAULT_DHIKR_SEQUENCE,
  DhikrItem,
  getNextDhikr,
  GroupPassage,
} from '../../core/awrad/awrad-data';
import { AwradStore } from '../../core/awrad/awrad.store';
import { ar } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-awrad',
  imports: [Icon, Sheet, FormsModule],
  templateUrl: './awrad.html',
  styleUrl: './awrad.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Awrad {
  private readonly awradStore = inject(AwradStore);
  protected readonly ar = ar;

  // Tasbeeh
  readonly currentDhikr = signal<DhikrItem>(DEFAULT_DHIKR_SEQUENCE[0]);
  readonly count = signal<number>(0);
  readonly totalTasbeeh = signal<number>(0);
  readonly isPulsing = signal<boolean>(false);
  readonly dhikrOptions = DEFAULT_DHIKR_SEQUENCE;

  // Progress rings
  readonly mobileDashArray = computed(() =>
    calcDashArray(this.count(), this.currentDhikr().target, 72)
  );

  readonly desktopDashArray = computed(() =>
    calcDashArray(this.count(), this.currentDhikr().target, 116)
  );

  // Groups
  readonly groups = this.awradStore.groups;
  readonly activeGroup = signal<AyahGroup | null>(null);
  readonly groupSheetOpen = signal<boolean>(false);
  readonly passageCounts = signal<Record<string, number>>({});

  // Adhkar
  readonly adhkarCategories = signal<readonly AdhkarCategory[]>(BUILTIN_ADHKAR);
  readonly activeAdhkar = signal<AdhkarCategory | null>(null);
  readonly adhkarSheetOpen = signal<boolean>(false);
  readonly adhkarCounts = signal<Record<string, number>>({});

  // New Group modal
  readonly newGroupSheetOpen = signal<boolean>(false);
  newGroupName = '';

  @HostListener('window:keydown', ['$event'])
  handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space' && !this.groupSheetOpen() && !this.adhkarSheetOpen() && !this.newGroupSheetOpen()) {
      e.preventDefault();
      this.increment();
    }
  }

  increment() {
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
      // Transition to next dhikr automatically (33 -> 33 -> 34)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([30, 40, 30]);
      }
      const nextDhikr = getNextDhikr(this.currentDhikr().id);
      this.currentDhikr.set(nextDhikr);
      this.count.set(0);
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

  // Groups management
  openGroup(group: AyahGroup) {
    this.activeGroup.set(group);
    this.groupSheetOpen.set(true);
  }

  closeGroup() {
    this.groupSheetOpen.set(false);
  }

  incrementPassage(p: GroupPassage) {
    const cur = this.passageCounts()[p.id] ?? 0;
    if (cur < p.targetRepeat) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
      this.passageCounts.update((map) => ({ ...map, [p.id]: cur + 1 }));
    }
  }

  // Adhkar management
  openAdhkar(category: AdhkarCategory) {
    this.activeAdhkar.set(category);
    this.adhkarSheetOpen.set(true);
  }

  closeAdhkar() {
    this.adhkarSheetOpen.set(false);
  }

  incrementAdhkar(itemId: string, target: number) {
    const cur = this.adhkarCounts()[itemId] ?? 0;
    if (cur < target) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
      this.adhkarCounts.update((map) => ({ ...map, [itemId]: cur + 1 }));
    }
  }

  openNewGroupModal() {
    this.newGroupName = '';
    this.newGroupSheetOpen.set(true);
  }

  closeNewGroupModal() {
    this.newGroupSheetOpen.set(false);
  }

  getPassageCount(id: string): number {
    return this.passageCounts()[id] || 0;
  }

  getAdhkarCount(id: string): number {
    return this.adhkarCounts()[id] || 0;
  }

  saveNewGroup() {
    const name = this.newGroupName.trim();
    if (!name) return;
    this.awradStore.addGroup(name);
    this.closeNewGroupModal();
  }
}
