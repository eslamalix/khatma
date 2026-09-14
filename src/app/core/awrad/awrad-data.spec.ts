import { describe, expect, it } from 'vitest';
import {
  BUILTIN_ADHKAR,
  BUILTIN_GROUPS,
  calcDashArray,
  DEFAULT_DHIKR_SEQUENCE,
  getNextDhikr,
} from './awrad-data';

describe('awrad-data', () => {
  it('has valid default tasbeeh sequence of 3 items (33, 33, 34)', () => {
    expect(DEFAULT_DHIKR_SEQUENCE.length).toBe(3);
    expect(DEFAULT_DHIKR_SEQUENCE[0].target).toBe(33);
    expect(DEFAULT_DHIKR_SEQUENCE[1].target).toBe(33);
    expect(DEFAULT_DHIKR_SEQUENCE[2].target).toBe(34);
  });

  it('cycles through tasbeeh sequence automatically', () => {
    const d1 = DEFAULT_DHIKR_SEQUENCE[0];
    const d2 = getNextDhikr(d1.id);
    expect(d2.id).toBe('alhamdulillah');

    const d3 = getNextDhikr(d2.id);
    expect(d3.id).toBe('allahu-akbar');

    const dLoop = getNextDhikr(d3.id);
    expect(dLoop.id).toBe('subhan-allah');
  });

  it('calculates SVG circular stroke dasharray with correct proportions', () => {
    const r = 72;
    const circumference = 2 * Math.PI * r;

    // 0 progress
    const dash0 = calcDashArray(0, 33, r);
    expect(dash0).toBe(`0.0 ${circumference.toFixed(1)}`);

    // Half progress
    const dashHalf = calcDashArray(16.5, 33, r);
    expect(dashHalf).toBe(`${(circumference * 0.5).toFixed(1)} ${circumference.toFixed(1)}`);

    // Full progress
    const dashFull = calcDashArray(33, 33, r);
    expect(dashFull).toBe(`${circumference.toFixed(1)} ${circumference.toFixed(1)}`);
  });

  it('includes built-in groups (Tahseen and Ruqyah) with passages', () => {
    expect(BUILTIN_GROUPS.length).toBe(2);
    const tahseen = BUILTIN_GROUPS.find((g) => g.id === 'tahseen');
    expect(tahseen).toBeDefined();
    expect(tahseen?.passages.length).toBeGreaterThanOrEqual(4);

    const ruqyah = BUILTIN_GROUPS.find((g) => g.id === 'ruqyah');
    expect(ruqyah).toBeDefined();
    expect(ruqyah?.passages.length).toBeGreaterThanOrEqual(6);
  });

  it('includes Morning and Evening Adhkar with valid targets', () => {
    expect(BUILTIN_ADHKAR.length).toBe(2);
    const morning = BUILTIN_ADHKAR.find((a) => a.id === 'morning');
    const evening = BUILTIN_ADHKAR.find((a) => a.id === 'evening');

    expect(morning).toBeDefined();
    expect(morning?.items.length).toBeGreaterThan(0);
    expect(evening).toBeDefined();
    expect(evening?.items.length).toBeGreaterThan(0);
  });
});
