import { AyahGroup } from './awrad-data';

/** Ids of deleted groups and passages, each with when it was deleted. */
export type Tombstones = Record<string, number>;

export interface GroupsMerge {
  groups: AyahGroup[];
  /** The cloud copy had something this device did not. */
  changed: boolean;
  /** The cloud copy still holds something deleted here, so it has to be rewritten without it. */
  cleanup: boolean;
}

/**
 * Brings the cloud copy of the ayah groups together with this device's copy. Additions from both sides
 * are kept, because two phones may each have added something; a deletion is only respected when it is
 * recorded as a tombstone, otherwise the other device hands the group straight back on the next merge.
 */
export function mergeGroups(local: AyahGroup[], cloud: AyahGroup[], tombstones: Tombstones): GroupsMerge {
  const groups = [...local];
  let changed = false;
  let cleanup = false;

  for (const incoming of cloud) {
    if (tombstones[incoming.id]) {
      cleanup = true;
      continue;
    }
    const index = groups.findIndex((g) => g.id === incoming.id);
    if (index < 0) {
      groups.push(incoming);
      changed = true;
      continue;
    }
    const mine = groups[index];
    const passages = [...mine.passages];
    let passagesChanged = false;
    for (const passage of incoming.passages) {
      if (tombstones[passage.id]) {
        cleanup = true;
        continue;
      }
      if (!passages.some((p) => p.id === passage.id)) {
        passages.push(passage);
        passagesChanged = true;
      }
    }
    if (passagesChanged) {
      groups[index] = { ...mine, passages };
      changed = true;
    }
  }

  return { groups, changed, cleanup };
}
