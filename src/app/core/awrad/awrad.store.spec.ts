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
});
