import { AyahGroup, GroupPassage } from './awrad-data';
import { mergeGroups } from './groups-merge';

const passage = (id: string): GroupPassage => ({
  id,
  title: 'آية',
  reference: 'البقرة ٢٥٥',
  text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ',
  targetRepeat: 1,
});

const group = (id: string, passages: GroupPassage[] = []): AyahGroup => ({
  id,
  title: `مجموعة ${id}`,
  description: 'مجموعة مخصصة',
  icon: 'shield',
  passages,
});

describe('mergeGroups', () => {
  it('keeps what each device added on its own', () => {
    const merged = mergeGroups([group('a')], [group('b')], {});
    expect(merged.groups.map((g) => g.id)).toEqual(['a', 'b']);
    expect(merged.changed).toBe(true);
  });

  it('keeps a group deleted here from coming back from the cloud', () => {
    const merged = mergeGroups([group('a')], [group('a'), group('b')], { b: Date.now() });
    expect(merged.groups.map((g) => g.id)).toEqual(['a']);
    expect(merged.cleanup).toBe(true);
  });

  it('keeps a deleted passage from coming back inside a group that stayed', () => {
    const merged = mergeGroups([group('a', [passage('p1')])], [group('a', [passage('p1'), passage('p2')])], {
      p2: Date.now(),
    });
    expect(merged.groups[0].passages.map((p) => p.id)).toEqual(['p1']);
    expect(merged.cleanup).toBe(true);
  });

  it('still accepts a passage added on another device', () => {
    const merged = mergeGroups([group('a', [passage('p1')])], [group('a', [passage('p1'), passage('p2')])], {});
    expect(merged.groups[0].passages.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(merged.changed).toBe(true);
  });

  it('reports nothing to do when both copies already match', () => {
    const merged = mergeGroups([group('a', [passage('p1')])], [group('a', [passage('p1')])], {});
    expect(merged.changed).toBe(false);
    expect(merged.cleanup).toBe(false);
  });
});
