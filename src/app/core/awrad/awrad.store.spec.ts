import { describe, it, expect, beforeEach } from 'vitest';
import { AwradStore } from './awrad.store';
import { BUILTIN_GROUPS } from './awrad-data';

describe('AwradStore', () => {
  let store: AwradStore;

  beforeEach(() => {
    localStorage.clear();
    store = new AwradStore();
  });

  it('initializes with builtin groups when storage is empty', () => {
    expect(store.groups().length).toBe(BUILTIN_GROUPS.length);
    expect(store.groups()[0].id).toBe('tahseen');
  });

  it('can add a new group and persists to storage', () => {
    const created = store.addGroup('أذكار الصلاة');
    expect(created.title).toBe('أذكار الصلاة');
    expect(store.groups().some((g) => g.id === created.id)).toBe(true);

    const reloadedStore = new AwradStore();
    expect(reloadedStore.groups().some((g) => g.title === 'أذكار الصلاة')).toBe(true);
  });

  it('can add an ayah passage to an existing group', () => {
    const passage = store.addPassageToGroup('tahseen', {
      title: 'آية مضافة',
      reference: 'سورة البقرة: ٢٥٥',
      text: 'الله لا إله إلا هو',
      targetRepeat: 3,
    });

    const tahseen = store.groups().find((g) => g.id === 'tahseen');
    expect(tahseen?.passages.some((p) => p.id === passage.id)).toBe(true);
    expect(passage.targetRepeat).toBe(3);
  });

  it('renames, deletes and restores a group in place', () => {
    store.renameGroup('tahseen', 'حصني');
    expect(store.groups()[0].title).toBe('حصني');
    const removed = store.deleteGroup('tahseen');
    expect(store.groups().some((g) => g.id === 'tahseen')).toBe(false);
    store.restoreGroup(removed!.group, removed!.index);
    expect(store.groups()[0].id).toBe('tahseen');
  });

  it('keeps an empty list after every group is deleted', () => {
    for (const g of store.groups()) store.deleteGroup(g.id);
    expect(new AwradStore().groups()).toHaveLength(0);
  });

  it('removes, restores, reorders and re-targets passages', () => {
    const ids = store.groups()[0].passages.map((p) => p.id);
    const removed = store.removePassage('tahseen', ids[1]);
    expect(store.groups()[0].passages.map((p) => p.id)).toEqual([ids[0], ...ids.slice(2)]);
    store.restorePassage('tahseen', removed!.passage, removed!.index);
    expect(store.groups()[0].passages.map((p) => p.id)).toEqual(ids);

    store.movePassage('tahseen', 0, 2);
    expect(store.groups()[0].passages.map((p) => p.id).slice(0, 3)).toEqual([ids[1], ids[2], ids[0]]);

    store.setPassageRepeat('tahseen', ids[0], 7);
    expect(store.groups()[0].passages.find((p) => p.id === ids[0])?.targetRepeat).toBe(7);
  });

  it('moves a passage to another group', () => {
    const [from, to] = store.groups();
    const passageId = from.passages[0].id;
    store.movePassageToGroup(from.id, passageId, to.id);
    expect(store.groups()[0].passages.some((p) => p.id === passageId)).toBe(false);
    expect(store.groups()[1].passages.at(-1)?.id).toBe(passageId);
  });
});
