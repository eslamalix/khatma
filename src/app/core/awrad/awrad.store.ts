import { Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import { AyahGroup, BUILTIN_GROUPS, GroupPassage } from './awrad-data';
import { mergeGroups } from './groups-merge';

const GROUPS_STORAGE_KEY = 'quran_kpi_groups';
const GROUPS_UPDATED_KEY = 'quran_kpi_groups_updated';
/** Ids of deleted groups and passages, with when they were deleted. */
const GROUPS_REMOVED_KEY = 'quran_kpi_groups_removed';
/** How long a deletion keeps travelling between devices before it is forgotten. */
const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

interface GroupsDoc {
  groups: AyahGroup[];
  removed?: Record<string, number>;
}

/** Deletions older than the window cannot still be in flight, so they stop taking up room. */
function prune(removed: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  return Object.fromEntries(Object.entries(removed).filter(([, at]) => at > cutoff));
}

@Injectable({ providedIn: 'root' })
export class AwradStore {
  readonly groups = signal<AyahGroup[]>(this.loadGroups());
  /** What this device deleted, so the deletion reaches the other devices instead of being undone by them. */
  private readonly removed = signal<Record<string, number>>(this.loadRemoved());
  private readonly cloud = injectOptional(CloudSync);

  constructor() {
    this.cloud?.registerDoc<GroupsDoc>({
      name: 'groups',
      read: () => ({ data: { groups: this.groups(), removed: this.removed() }, updatedAt: this.updatedAt() }),
      apply: (data, updatedAt) => {
        if (!Array.isArray(data.groups)) return;
        this.removed.set(prune(data.removed ?? {}));
        this.groups.set(this.withoutRemoved(data.groups));
        this.saveGroups(updatedAt);
      },
      merge: (cloudData, cloudUpdatedAt) => {
        if (!Array.isArray(cloudData.groups)) return;
        if (this.updatedAt() === cloudUpdatedAt) return;

        // A deletion has to travel as well: on its own, a union merge keeps handing the group back.
        const tombstones = prune({ ...(cloudData.removed ?? {}) });
        for (const [id, at] of Object.entries(this.removed())) tombstones[id] = Math.max(tombstones[id] ?? 0, at);

        const { groups, changed, cleanup } = mergeGroups(this.groups(), cloudData.groups, tombstones);

        this.removed.set(tombstones);
        if (changed || cleanup || cloudUpdatedAt > this.updatedAt()) {
          this.groups.set(groups);
          this.saveGroups();
        } else {
          this.saveRemoved();
        }
      },
      reset: () => {
        try {
          localStorage.removeItem(GROUPS_STORAGE_KEY);
          localStorage.removeItem(GROUPS_UPDATED_KEY);
          localStorage.removeItem(GROUPS_REMOVED_KEY);
        } catch {
          // Nothing kept, nothing to clear.
        }
        this.removed.set({});
        this.groups.set([...BUILTIN_GROUPS]);
      },
    });
  }

  addGroup(title: string, description = 'مجموعة مخصصة', icon: 'shield' | 'leaf' = 'shield'): AyahGroup {
    const trimmed = title.trim();
    const newGroup: AyahGroup = {
      id: `custom-${Date.now()}`,
      title: trimmed || 'مجموعة جديدة',
      description,
      icon,
      passages: [],
    };
    this.groups.update((list) => [...list, newGroup]);
    this.saveGroups();
    return newGroup;
  }

  addPassageToGroup(
    groupId: string,
    passage: Omit<GroupPassage, 'id'>,
  ): GroupPassage {
    const newPassage: GroupPassage = {
      id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...passage,
    };

    this.groups.update((list) =>
      list.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          passages: [...group.passages, newPassage],
        };
      }),
    );

    this.saveGroups();
    return newPassage;
  }

  renameGroup(groupId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    this.patchGroup(groupId, (g) => ({ ...g, title: trimmed }));
  }

  /** Removes a group; returns what is needed to undo it. */
  deleteGroup(groupId: string): { group: AyahGroup; index: number } | null {
    const index = this.groups().findIndex((g) => g.id === groupId);
    if (index < 0) return null;
    const group = this.groups()[index];
    this.groups.update((list) => list.filter((g) => g.id !== groupId));
    this.mark(groupId);
    this.saveGroups();
    return { group, index };
  }

  restoreGroup(group: AyahGroup, index: number) {
    this.unmark(group.id);
    this.groups.update((list) => {
      const next = list.filter((g) => g.id !== group.id);
      next.splice(Math.min(index, next.length), 0, group);
      return next;
    });
    this.saveGroups();
  }

  /** Removes a passage from a group; returns what is needed to undo it. */
  removePassage(groupId: string, passageId: string): { passage: GroupPassage; index: number } | null {
    const group = this.groups().find((g) => g.id === groupId);
    const index = group?.passages.findIndex((p) => p.id === passageId) ?? -1;
    if (!group || index < 0) return null;
    const passage = group.passages[index];
    this.mark(passageId);
    this.patchGroup(groupId, (g) => ({ ...g, passages: g.passages.filter((p) => p.id !== passageId) }));
    return { passage, index };
  }

  restorePassage(groupId: string, passage: GroupPassage, index: number) {
    this.unmark(passage.id);
    this.patchGroup(groupId, (g) => {
      const passages = g.passages.filter((p) => p.id !== passage.id);
      passages.splice(Math.min(index, passages.length), 0, passage);
      return { ...g, passages };
    });
  }

  setPassageRepeat(groupId: string, passageId: string, targetRepeat: number) {
    const n = Math.min(999, Math.max(1, Math.round(targetRepeat)));
    this.patchGroup(groupId, (g) => ({
      ...g,
      passages: g.passages.map((p) => (p.id === passageId ? { ...p, targetRepeat: n } : p)),
    }));
  }

  movePassage(groupId: string, from: number, to: number) {
    this.patchGroup(groupId, (g) => {
      if (from === to || from < 0 || from >= g.passages.length) return g;
      const passages = [...g.passages];
      const [item] = passages.splice(from, 1);
      passages.splice(Math.max(0, Math.min(to, passages.length)), 0, item);
      return { ...g, passages };
    });
  }

  /** Moves a passage to the end of another group. */
  movePassageToGroup(fromGroupId: string, passageId: string, toGroupId: string) {
    if (fromGroupId === toGroupId) return;
    const moved = this.removePassage(fromGroupId, passageId);
    if (!moved) return;
    // It moved, it was not deleted: the tombstone would erase it again on the next merge.
    this.unmark(passageId);
    this.patchGroup(toGroupId, (g) => ({ ...g, passages: [...g.passages, moved.passage] }));
  }

  private patchGroup(groupId: string, fn: (g: AyahGroup) => AyahGroup) {
    this.groups.update((list) => list.map((g) => (g.id === groupId ? fn(g) : g)));
    this.saveGroups();
  }

  private loadGroups(): AyahGroup[] {
    try {
      if (typeof localStorage === 'undefined') return [...BUILTIN_GROUPS];
      const saved = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // An empty list is a real choice (every group deleted), not a reason to bring the defaults back.
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback on parse failure or SSR
    }
    return [...BUILTIN_GROUPS];
  }

  /** `fromCloud` carries the cloud copy timestamp; a local change stamps now and uploads. */
  private saveGroups(fromCloud?: number): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(this.groups()));
        localStorage.setItem(GROUPS_UPDATED_KEY, String(fromCloud ?? Date.now()));
      }
    } catch {
      // Ignore quota errors
    }
    this.saveRemoved();
    if (fromCloud === undefined) this.cloud?.touchDoc('groups');
  }

  /** Remember a deletion until every device has seen it. */
  private mark(id: string) {
    this.removed.update((map) => ({ ...map, [id]: Date.now() }));
  }

  /** It came back (undo, or a move between groups), so the deletion no longer holds. */
  private unmark(id: string) {
    this.removed.update(({ [id]: _gone, ...rest }) => rest);
  }

  private withoutRemoved(groups: AyahGroup[]): AyahGroup[] {
    const tombstones = this.removed();
    return groups
      .filter((g) => !tombstones[g.id])
      .map((g) => ({ ...g, passages: g.passages.filter((p) => !tombstones[p.id]) }));
  }

  private saveRemoved(): void {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(GROUPS_REMOVED_KEY, JSON.stringify(this.removed()));
    } catch {
      // Ignore quota errors
    }
  }

  private loadRemoved(): Record<string, number> {
    try {
      if (typeof localStorage === 'undefined') return {};
      const saved = JSON.parse(localStorage.getItem(GROUPS_REMOVED_KEY) ?? 'null') as Record<string, number> | null;
      return saved ? prune(saved) : {};
    } catch {
      return {};
    }
  }

  private updatedAt(): number {
    try {
      return Number(localStorage.getItem(GROUPS_UPDATED_KEY)) || 0;
    } catch {
      return 0;
    }
  }
}
