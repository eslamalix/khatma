import { Injectable, signal } from '@angular/core';
import { CloudSync, injectOptional } from '../sync/cloud-sync';
import { AyahGroup, BUILTIN_GROUPS, GroupPassage } from './awrad-data';

const GROUPS_STORAGE_KEY = 'quran_kpi_groups';
const GROUPS_UPDATED_KEY = 'quran_kpi_groups_updated';

@Injectable({ providedIn: 'root' })
export class AwradStore {
  readonly groups = signal<AyahGroup[]>(this.loadGroups());
  private readonly cloud = injectOptional(CloudSync);

  constructor() {
    this.cloud?.registerDoc<{ groups: AyahGroup[] }>({
      name: 'groups',
      read: () => ({ data: { groups: this.groups() }, updatedAt: this.updatedAt() }),
      apply: (data, updatedAt) => {
        if (!Array.isArray(data.groups)) return;
        this.groups.set(data.groups);
        this.saveGroups(updatedAt);
      },
      merge: (cloudData, cloudUpdatedAt) => {
        if (!Array.isArray(cloudData.groups)) return;
        if (this.updatedAt() === cloudUpdatedAt) return;
        
        const localGroups = [...this.groups()];
        let changed = false;

        for (const cg of cloudData.groups) {
          const lgIndex = localGroups.findIndex((g) => g.id === cg.id);
          if (lgIndex < 0) {
            localGroups.push(cg);
            changed = true;
          } else {
            const lg = localGroups[lgIndex];
            const mergedPassages = [...lg.passages];
            let passagesChanged = false;
            for (const cp of cg.passages) {
              if (!mergedPassages.find((p) => p.id === cp.id)) {
                mergedPassages.push(cp);
                passagesChanged = true;
              }
            }
            if (passagesChanged) {
              localGroups[lgIndex] = { ...lg, passages: mergedPassages };
              changed = true;
            }
          }
        }

        if (changed || cloudUpdatedAt > this.updatedAt()) {
          this.groups.set(localGroups);
          this.saveGroups();
        }
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
    this.saveGroups();
    return { group, index };
  }

  restoreGroup(group: AyahGroup, index: number) {
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
    this.patchGroup(groupId, (g) => ({ ...g, passages: g.passages.filter((p) => p.id !== passageId) }));
    return { passage, index };
  }

  restorePassage(groupId: string, passage: GroupPassage, index: number) {
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
    const removed = this.removePassage(fromGroupId, passageId);
    if (removed) this.patchGroup(toGroupId, (g) => ({ ...g, passages: [...g.passages, removed.passage] }));
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
    if (fromCloud === undefined) this.cloud?.touchDoc('groups');
  }

  private updatedAt(): number {
    try {
      return Number(localStorage.getItem(GROUPS_UPDATED_KEY)) || 0;
    } catch {
      return 0;
    }
  }
}
