import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildMarks,
  DEFAULT_THEMES,
  filterReflections,
  juzSpread,
  mergeTadabbur,
  normalizeArabic,
  Reflection,
  reflectionAt,
  reflectionsAsText,
  TadabburData,
} from './tadabbur';
import { TadabburStore } from './tadabbur.store';

const themes = DEFAULT_THEMES.map((t) => ({ ...t }));

function reflection(over: Partial<Reflection> & Pick<Reflection, 'id'>): Reflection {
  return {
    surah: 2,
    from: 5,
    to: 5,
    page: 2,
    text: 'نص',
    themes: [],
    note: '',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

const data = (over: Partial<TadabburData> = {}): TadabburData => ({
  themes,
  reflections: [],
  removed: {},
  ...over,
});

describe('tadabbur marks', () => {
  it('colours each ayah of a reflection by its first known theme', () => {
    const marks = buildMarks(
      [reflection({ id: 'a', from: 5, to: 7, themes: ['gone', 'warning', 'mercy'] })],
      themes,
    );
    expect([...marks.keys()]).toEqual(['2:5', '2:6', '2:7']);
    expect(marks.get('2:6')).toEqual({ reflectionId: 'a', color: 'red', hasNote: false });
  });

  it('lets the narrowest reflection own an ayah where two overlap', () => {
    const list = [
      reflection({ id: 'wide', from: 1, to: 10, themes: ['stories'] }),
      reflection({ id: 'one', from: 4, to: 4, themes: ['dua'], note: 'x' }),
    ];
    const marks = buildMarks(list, themes);
    expect(marks.get('2:4')).toEqual({ reflectionId: 'one', color: 'blue', hasNote: true });
    expect(marks.get('2:5')?.reflectionId).toBe('wide');
    expect(reflectionAt(list, 2, 4)?.id).toBe('one');
    expect(reflectionAt(list, 2, 11)).toBeNull();
  });

  it('keeps a note-only reflection visible without a colour', () => {
    expect(buildMarks([reflection({ id: 'n', note: 'تأمل' })], themes).get('2:5')).toEqual({
      reflectionId: 'n',
      color: null,
      hasNote: true,
    });
  });
});

describe('tadabbur journal', () => {
  it('matches Arabic regardless of diacritics and letter forms', () => {
    expect(normalizeArabic('ٱلرَّحۡمَةِ')).toBe('الرحمه');
    expect(normalizeArabic('إِلَىٰ')).toBe('الي');
  });

  it('filters by theme and search text, in mushaf order or newest first', () => {
    const list = [
      reflection({
        id: 'b',
        surah: 7,
        from: 56,
        themes: ['mercy'],
        text: 'إِنَّ رَحۡمَتَ ٱللَّهِ قَرِيبٞ',
        createdAt: 3,
      }),
      reflection({
        id: 'a',
        surah: 2,
        from: 5,
        themes: ['mercy', 'dua'],
        note: 'دعاء جميل',
        createdAt: 1,
      }),
      reflection({ id: 'c', surah: 2, from: 7, themes: ['warning'], createdAt: 2 }),
    ];
    const name = (n: number) => (n === 2 ? 'البقرة' : 'الأعراف');
    const ids = (theme: string | null, query: string, sort: 'mushaf' | 'recent') =>
      filterReflections(list, { theme, query, sort, surahName: name }).map((r) => r.id);
    expect(ids(null, '', 'mushaf')).toEqual(['a', 'c', 'b']);
    expect(ids(null, '', 'recent')).toEqual(['b', 'c', 'a']);
    expect(ids('mercy', '', 'mushaf')).toEqual(['a', 'b']);
    expect(ids(null, 'رحمت', 'mushaf')).toEqual(['b']);
    expect(ids(null, 'دعاء', 'mushaf')).toEqual(['a']);
    expect(ids(null, 'الاعراف', 'mushaf')).toEqual(['b']);
  });

  it('spreads reflections over the thirty juz', () => {
    const spread = juzSpread([
      reflection({ id: 'a', page: 1 }),
      reflection({ id: 'b', page: 22 }),
      reflection({ id: 'c', page: 604 }),
    ]);
    expect(spread[0]).toBe(1);
    expect(spread[1]).toBe(1);
    expect(spread[29]).toBe(1);
    expect(spread.reduce((a, b) => a + b)).toBe(3);
  });

  it('shares ayahs with their reference and note', () => {
    const text = reflectionsAsText(
      [
        reflection({ id: 'a', from: 1, to: 2, text: 'أ ۝ ب', note: ' فائدة ' }),
        reflection({ id: 'b', from: 9, to: 9, text: 'ج' }),
      ],
      () => 'البقرة',
      String,
    );
    expect(text).toBe('﴿أ ب﴾ [البقرة: 1-2]\nفائدة\n\n﴿ج﴾ [البقرة: 9]');
  });
});

describe('tadabbur merge', () => {
  it('keeps additions from both devices and the newer edit of the same item', () => {
    const local = data({
      reflections: [
        reflection({ id: 'a', note: 'old', updatedAt: 1 }),
        reflection({ id: 'mine', updatedAt: 1 }),
      ],
    });
    const cloud = data({
      reflections: [
        reflection({ id: 'a', note: 'new', updatedAt: 5 }),
        reflection({ id: 'theirs', updatedAt: 1 }),
      ],
    });
    const merged = mergeTadabbur(local, cloud);
    expect(merged.data.reflections.map((r) => r.id).sort()).toEqual(['a', 'mine', 'theirs']);
    expect(merged.data.reflections.find((r) => r.id === 'a')?.note).toBe('new');
    expect(merged.changed).toBe(true);
    expect(merged.cleanup).toBe(true);
  });

  it('respects deletions from either side through tombstones', () => {
    const local = data({
      reflections: [reflection({ id: 'deletedThere' })],
      removed: { deletedHere: 9 },
    });
    const cloud = data({
      reflections: [reflection({ id: 'deletedHere' })],
      removed: { deletedThere: 9 },
    });
    const merged = mergeTadabbur(local, cloud);
    expect(merged.data.reflections).toEqual([]);
    expect(merged.data.removed).toEqual({ deletedHere: 9, deletedThere: 9 });
    expect(merged.changed).toBe(true);
    expect(merged.cleanup).toBe(true);
  });

  it('reports nothing to do when both copies agree', () => {
    const same = data({ reflections: [reflection({ id: 'a' })] });
    const merged = mergeTadabbur(same, structuredClone(same));
    expect(merged.changed).toBe(false);
    expect(merged.cleanup).toBe(false);
  });
});

describe('TadabburStore', () => {
  let store: TadabburStore;
  const draft = { surah: 2, from: 255, to: 255, page: 42, text: 'آية الكرسي' };

  beforeEach(() => {
    localStorage.clear();
    store = new TadabburStore();
  });

  it('starts with the starter themes, focused on the first, and keeps what is marked', () => {
    expect(store.themes().map((t) => t.id)).toEqual(DEFAULT_THEMES.map((t) => t.id));
    expect(store.focusTheme()?.id).toBe('mercy');
    const r = store.create(draft, ['names']);
    store.update(r.id, { note: 'أعظم آية' });
    const reloaded = new TadabburStore();
    expect(reloaded.at(2, 255)?.note).toBe('أعظم آية');
    expect(reloaded.marks().get('2:255')?.color).toBe('gold');
  });

  it('remembers a free-reflection focus and the mode across reloads', () => {
    store.setFocus(null);
    store.setActive(true);
    const reloaded = new TadabburStore();
    expect(reloaded.focusThemeId()).toBeNull();
    expect(reloaded.active()).toBe(true);
  });

  it('toggles themes, drops empty reflections and restores deletions', () => {
    const r = store.create(draft, ['mercy']);
    store.toggleTheme(r.id, 'dua');
    expect(store.get(r.id)?.themes).toEqual(['mercy', 'dua']);
    store.toggleTheme(r.id, 'mercy');
    store.toggleTheme(r.id, 'dua');
    store.dropIfEmpty(r.id);
    expect(store.get(r.id)).toBeNull();

    const kept = store.create(draft, ['warning']);
    const removed = store.remove(kept.id)!;
    store.restore(removed.reflection, removed.index);
    expect(store.get(kept.id)?.themes).toEqual(['warning']);
  });

  it('deletes a theme without losing marks, so undo brings them back', () => {
    const r = store.create(draft, ['warning']);
    store.setFocus('warning');
    const gone = store.deleteTheme('warning')!;
    expect(store.marks().get('2:255')?.color).toBeNull();
    expect(store.focusThemeId()).toBe('mercy');
    store.restoreTheme(gone.theme, gone.index);
    expect(store.marks().get('2:255')?.color).toBe('red');
    expect(store.get(r.id)?.themes).toEqual(['warning']);
  });

  it('gives a new theme a colour not used yet', () => {
    expect(store.addTheme('الجنة').color).toBe('teal');
    expect(store.addTheme('   ').name).toBe('موضوع جديد');
  });
});
