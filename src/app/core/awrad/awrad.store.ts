import { Injectable, signal } from '@angular/core';
import { AyahGroup, BUILTIN_GROUPS, GroupPassage } from './awrad-data';

const GROUPS_STORAGE_KEY = 'quran_kpi_groups';

@Injectable({ providedIn: 'root' })
export class AwradStore {
  readonly groups = signal<AyahGroup[]>(this.loadGroups());

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

  private loadGroups(): AyahGroup[] {
    try {
      if (typeof localStorage === 'undefined') return [...BUILTIN_GROUPS];
      const saved = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback on parse failure or SSR
    }
    return [...BUILTIN_GROUPS];
  }

  private saveGroups(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(this.groups()));
      }
    } catch {
      // Ignore quota errors
    }
  }
}
