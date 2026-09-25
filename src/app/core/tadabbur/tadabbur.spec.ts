import { beforeEach, describe, expect, it } from 'vitest';
import {
  ayahsLabel,
  buildMarks,
  CardAyah,
  DEFAULT_THEMES,
  filterReflections,
  juzSpread,
  mergeTadabbur,
  normalizeArabic,
  Reflection,
  reflectionsAsText,
  TadabburData,
  upgradeReflection,
  withAyahs,
} from './tadabbur';
import { TadabburStore } from './tadabbur.store';

const themes = DEFAULT_THEMES.map((t) => ({ ...t }));
const name = (n: number) => ({ 1: 'الفاتحة', 2: 'البقرة', 7: 'الأعراف' })[n] ?? `س${n}`;

const ay = (surah: number, ayah: number, text = 'نص', page = 2): CardAyah => ({
  surah,
  ayah,
  page,
  text,
});

function card(over: Partial<Reflection> & Pick<Reflection, 'id'>): Reflection {
  return {
    title: '',
    ayahs: [ay(2, 5)],
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

describe('tadabbur cards', () => {
  it('keeps ayahs in mushaf order and each one once', () => {
    const list = withAyahs([ay(2, 7)], [ay(2, 5), ay(1, 2), ay(2, 7)]);
    expect(list.map((a) => `${a.surah}:${a.ayah}`)).toEqual(['1:2', '2:5', '2:7']);
  });

  it('names scattered ayahs by surah and joins runs', () => {
    const label = ayahsLabel([ay(2, 7), ay(2, 5), ay(2, 6), ay(2, 12), ay(7, 56)], name, String);
    expect(label).toBe('البقرة 5–7، 12؛ الأعراف 56');
    expect(ayahsLabel([ay(1, 1), ay(2, 1), ay(3, 1), ay(4, 1)], name, String)).toBe(
      'الفاتحة 1؛ البقرة 1؛ س3 1 وغيرها',
    );
  });

  it('colours each ayah by the latest card that has a theme', () => {
    const marks = buildMarks(
      [
        card({ id: 'old', ayahs: [ay(2, 5), ay(2, 9)], themes: ['warning'], updatedAt: 1 }),
        card({ id: 'new', ayahs: [ay(2, 5)], themes: ['gone', 'mercy'], note: 'x', updatedAt: 5 }),
        card({ id: 'plain', ayahs: [ay(2, 9)], updatedAt: 9 }),
      ],
      themes,
    );
    expect(marks.get('2:5')).toEqual({ reflectionId: 'new', color: 'green', hasNote: true });
    expect(marks.get('2:9')?.reflectionId).toBe('old');
  });

  it('upgrades an old single-range entry into a card', () => {
    const old = {
      id: 'a',
      surah: 2,
      from: 5,
      to: 6,
      page: 2,
      text: 'أ ۝ ب',
      themes: ['mercy'],
      note: 'n',
      createdAt: 1,
      updatedAt: 2,
    };
    expect(upgradeReflection(old)).toEqual({
      id: 'a',
      title: '',
      ayahs: [ay(2, 5, 'أ'), ay(2, 6, 'ب')],
      themes: ['mercy'],
      note: 'n',
      createdAt: 1,
      updatedAt: 2,
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
      card({
        id: 'b',
        ayahs: [ay(7, 56, 'إِنَّ رَحۡمَتَ ٱللَّهِ قَرِيبٞ')],
        themes: ['mercy'],
        createdAt: 3,
      }),
      card({
        id: 'a',
        ayahs: [ay(2, 5), ay(7, 1)],
        themes: ['mercy', 'dua'],
        note: 'دعاء جميل',
        createdAt: 1,
      }),
      card({ id: 'c', ayahs: [ay(2, 7)], title: 'قلوب مختومة', themes: ['warning'], createdAt: 2 }),
    ];
    const ids = (theme: string | null, query: string, sort: 'mushaf' | 'recent') =>
      filterReflections(list, { theme, query, sort, surahName: name }).map((r) => r.id);
    expect(ids(null, '', 'mushaf')).toEqual(['a', 'c', 'b']);
    expect(ids(null, '', 'recent')).toEqual(['b', 'c', 'a']);
    expect(ids('mercy', '', 'mushaf')).toEqual(['a', 'b']);
    expect(ids(null, 'رحمت', 'mushaf')).toEqual(['b']);
    expect(ids(null, 'دعاء', 'mushaf')).toEqual(['a']);
    expect(ids(null, 'الاعراف', 'mushaf')).toEqual(['a', 'b']);
    expect(ids(null, 'مختومه', 'mushaf')).toEqual(['c']);
  });

  it('spreads distinct ayahs over the thirty juz', () => {
    const spread = juzSpread([
      card({ id: 'a', ayahs: [ay(1, 1, '', 1), ay(2, 200, '', 22)] }),
      card({ id: 'b', ayahs: [ay(1, 1, '', 1), ay(114, 1, '', 604)] }),
    ]);
    expect([spread[0], spread[1], spread[29]]).toEqual([1, 1, 1]);
    expect(spread.reduce((a, b) => a + b)).toBe(3);
  });

  it('shares cards with title, references and note', () => {
    const text = reflectionsAsText(
      [
        card({ id: 'a', title: ' خوف ', ayahs: [ay(2, 6, 'أ'), ay(2, 9, 'ب')], note: ' فائدة ' }),
        card({ id: 'b', ayahs: [ay(2, 9, 'ج')] }),
      ],
      name,
      String,
    );
    expect(text).toBe('«خوف»\n﴿أ﴾ [البقرة: 6]\n﴿ب﴾ [البقرة: 9]\nفائدة\n\n﴿ج﴾ [البقرة: 9]');
  });
});

describe('tadabbur merge', () => {
  it('keeps additions from both devices and the newer edit of the same card', () => {
    const local = data({
      reflections: [card({ id: 'a', note: 'old', updatedAt: 1 }), card({ id: 'mine' })],
    });
    const cloud = data({
      reflections: [card({ id: 'a', note: 'new', updatedAt: 5 }), card({ id: 'theirs' })],
    });
    const merged = mergeTadabbur(local, cloud);
    expect(merged.data.reflections.map((r) => r.id).sort()).toEqual(['a', 'mine', 'theirs']);
    expect(merged.data.reflections.find((r) => r.id === 'a')?.note).toBe('new');
    expect(merged.changed).toBe(true);
    expect(merged.cleanup).toBe(true);
  });

  it('respects deletions from either side through tombstones', () => {
    const local = data({
      reflections: [card({ id: 'deletedThere' })],
      removed: { deletedHere: 9 },
    });
    const cloud = data({
      reflections: [card({ id: 'deletedHere' })],
      removed: { deletedThere: 9 },
    });
    const merged = mergeTadabbur(local, cloud);
    expect(merged.data.reflections).toEqual([]);
    expect(merged.data.removed).toEqual({ deletedHere: 9, deletedThere: 9 });
    expect(merged.changed).toBe(true);
  });

  it('reports nothing to do when both copies agree', () => {
    const same = data({ reflections: [card({ id: 'a' })] });
    const merged = mergeTadabbur(same, structuredClone(same));
    expect(merged.changed).toBe(false);
    expect(merged.cleanup).toBe(false);
  });
});

describe('TadabburStore', () => {
  let store: TadabburStore;

  beforeEach(() => {
    localStorage.clear();
    store = new TadabburStore();
  });

  it('gathers ayahs across pages, a second tap takes one out, in mushaf order', () => {
    expect(store.toggleCollected(ay(2, 9))).toBe(true);
    store.toggleCollected(ay(2, 3));
    store.collect([ay(2, 5), ay(2, 6)]);
    expect(store.toggleCollected(ay(2, 5))).toBe(false);
    expect(store.collection().map((a) => a.ayah)).toEqual([3, 6, 9]);
    expect(store.isCollected(2, 6)).toBe(true);
    store.setActive(false);
    expect(store.collection()).toEqual([]);
  });

  it('keeps a card with scattered ayahs, and ayahs can be added and taken off later', () => {
    const r = store.create([ay(2, 9), ay(2, 3)], { title: 'الغيب', themes: ['warning'] });
    store.addAyahs(r.id, [ay(2, 5), ay(2, 3)]);
    expect(store.get(r.id)?.ayahs.map((a) => a.ayah)).toEqual([3, 5, 9]);
    const gone = store.removeAyah(r.id, 2, 5)!;
    expect(store.get(r.id)?.ayahs.map((a) => a.ayah)).toEqual([3, 9]);
    store.addAyahs(r.id, [gone]);
    store.update(r.id, { note: 'تأمل' });

    const reloaded = new TadabburStore();
    expect(reloaded.get(r.id)?.ayahs.map((a) => a.ayah)).toEqual([3, 5, 9]);
    expect(reloaded.marks().get('2:9')?.color).toBe('red');
    expect(reloaded.cardsWith(2, 3).map((c) => c.id)).toEqual([r.id]);
  });

  it('starts adding to a chosen card, and forgets it once the card is gone', () => {
    const r = store.create([ay(2, 1)]);
    store.addTo(r.id);
    expect(store.active()).toBe(true);
    expect(store.target()?.id).toBe(r.id);
    const removed = store.remove(r.id)!;
    expect(store.targetId()).toBeNull();
    store.restore(removed.reflection, removed.index);
    expect(store.get(r.id)).not.toBeNull();
  });

  it('deletes a theme without losing colours, so undo brings them back', () => {
    store.create([ay(2, 255)], { themes: ['warning'] });
    const gone = store.deleteTheme('warning')!;
    expect(store.marks().get('2:255')?.color).toBeNull();
    store.restoreTheme(gone.theme, gone.index);
    expect(store.marks().get('2:255')?.color).toBe('red');
  });

  it('gives a new theme a colour not used yet', () => {
    expect(store.addTheme('الجنة').color).toBe('teal');
    expect(store.addTheme('   ').name).toBe('موضوع جديد');
  });
});
