import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AyahGroup, GroupPassage } from '../../core/awrad/awrad-data';
import { AwradStore } from '../../core/awrad/awrad.store';
import { ar, counted, GROUPS, PASSAGES } from '../../core/format';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

@Component({
  selector: 'app-groups',
  imports: [Icon, Sheet, FormsModule, RouterLink, CdkDropList, CdkDrag, CdkDragHandle],
  templateUrl: './groups.html',
  styleUrls: ['./groups.scss', './groups-edit.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Groups {
  private readonly awradStore = inject(AwradStore);
  protected readonly ar = ar;
  protected readonly passagesLabel = (n: number) => (n ? counted(n, PASSAGES) : 'فارغة');
  /** Built from the passages themselves so it can never disagree with the count. */
  protected readonly preview = (g: AyahGroup) =>
    g.passages.length ? g.passages.map((p) => p.title).join('، ') : 'أضف آيات من المصحف';

  // Groups from store
  readonly groups = this.awradStore.groups;

  // Accordion state: Set of expanded group IDs.
  // Initially open the first group by default so the user immediately sees the drop-down content.
  readonly expandedGroupIds = signal<Set<string>>(new Set(['tahseen']));

  // Passages repetition counter
  readonly passageCounts = signal<Record<string, number>>({});

  // Summary counts
  readonly totalPassages = computed(() =>
    this.groups().reduce((acc, g) => acc + (g.passages?.length || 0), 0)
  );
  protected readonly summary = computed(() => {
    const groups = counted(this.groups().length, GROUPS);
    return this.totalPassages() ? `${groups}، ${counted(this.totalPassages(), PASSAGES)}` : groups;
  });
  protected readonly allExpanded = computed(() => this.groups().every((g) => this.expandedGroupIds().has(g.id)));

  // New Group Sheet
  readonly newGroupSheetOpen = signal<boolean>(false);
  newGroupName = '';

  // Editing: one sheet for a group, one for a passage, and an undo toast after deleting.
  protected readonly editGroupId = signal<string | null>(null);
  protected readonly editPassage = signal<{ groupId: string; passageId: string } | null>(null);
  protected readonly editingGroup = computed(() => this.groups().find((g) => g.id === this.editGroupId()) ?? null);
  protected readonly editingPassage = computed(() => {
    const ref = this.editPassage();
    if (!ref) return null;
    const group = this.groups().find((g) => g.id === ref.groupId);
    const passage = group?.passages.find((p) => p.id === ref.passageId);
    return group && passage ? { group, passage } : null;
  });
  protected readonly otherGroups = computed(() => this.groups().filter((g) => g.id !== this.editPassage()?.groupId));
  renameValue = '';
  protected readonly undo = signal<{ label: string; run: () => void } | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.undoTimer && clearTimeout(this.undoTimer));
  }

  toggleGroup(groupId: string) {
    this.expandedGroupIds.update((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroupIds().has(groupId);
  }

  expandAll() {
    this.expandedGroupIds.set(new Set(this.groups().map((g) => g.id)));
  }

  collapseAll() {
    this.expandedGroupIds.set(new Set());
  }

  toggleAll() {
    if (this.allExpanded()) this.collapseAll();
    else this.expandAll();
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

  resetPassage(pId: string, event: MouseEvent) {
    event.stopPropagation();
    this.passageCounts.update((map) => ({ ...map, [pId]: 0 }));
  }

  getPassageCount(id: string): number {
    return this.passageCounts()[id] || 0;
  }

  protected openGroupActions(groupId: string, event: Event) {
    event.stopPropagation();
    this.renameValue = this.groups().find((g) => g.id === groupId)?.title ?? '';
    this.editGroupId.set(groupId);
  }

  protected saveRename() {
    const id = this.editGroupId();
    if (id && this.renameValue.trim()) this.awradStore.renameGroup(id, this.renameValue);
    this.editGroupId.set(null);
  }

  protected deleteGroup() {
    const id = this.editGroupId();
    this.editGroupId.set(null);
    const removed = id && this.awradStore.deleteGroup(id);
    if (removed) this.offerUndo(`حُذفت «${removed.group.title}»`, () => this.awradStore.restoreGroup(removed.group, removed.index));
  }

  protected openPassageActions(groupId: string, passageId: string) {
    this.editPassage.set({ groupId, passageId });
  }

  protected stepRepeat(delta: number) {
    const e = this.editingPassage();
    if (e) this.awradStore.setPassageRepeat(e.group.id, e.passage.id, e.passage.targetRepeat + delta);
  }

  protected setRepeat(n: number) {
    const e = this.editingPassage();
    if (e) this.awradStore.setPassageRepeat(e.group.id, e.passage.id, n);
  }

  protected movePassageTo(toGroupId: string) {
    const e = this.editingPassage();
    if (!e) return;
    this.editPassage.set(null);
    this.awradStore.movePassageToGroup(e.group.id, e.passage.id, toGroupId);
    const target = this.groups().find((g) => g.id === toGroupId);
    this.expandedGroupIds.update((set) => new Set([...set, toGroupId]));
    this.offerUndo(`نُقل إلى «${target?.title ?? ''}»`, () => {
      const moved = this.awradStore.removePassage(toGroupId, e.passage.id);
      const index = e.group.passages.findIndex((p) => p.id === e.passage.id);
      if (moved) this.awradStore.restorePassage(e.group.id, moved.passage, index);
    });
  }

  protected deletePassage() {
    const e = this.editingPassage();
    if (!e) return;
    this.editPassage.set(null);
    const removed = this.awradStore.removePassage(e.group.id, e.passage.id);
    if (removed) {
      this.offerUndo(`حُذف «${removed.passage.title}»`, () =>
        this.awradStore.restorePassage(e.group.id, removed.passage, removed.index),
      );
    }
  }

  protected dropPassage(groupId: string, event: CdkDragDrop<unknown>) {
    this.awradStore.movePassage(groupId, event.previousIndex, event.currentIndex);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10);
  }

  protected runUndo() {
    this.undo()?.run();
    this.dismissUndo();
  }

  protected dismissUndo() {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undo.set(null);
  }

  private offerUndo(label: string, run: () => void) {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undo.set({ label, run });
    this.undoTimer = setTimeout(() => this.undo.set(null), 6000);
  }

  openNewGroupModal() {
    this.newGroupName = '';
    this.newGroupSheetOpen.set(true);
  }

  closeNewGroupModal() {
    this.newGroupSheetOpen.set(false);
  }

  saveNewGroup() {
    const name = this.newGroupName.trim();
    if (!name) return;
    const newGroup = this.awradStore.addGroup(name);
    // Expand the newly created group automatically
    this.expandedGroupIds.update((set) => new Set([...set, newGroup.id]));
    this.closeNewGroupModal();
  }
}
