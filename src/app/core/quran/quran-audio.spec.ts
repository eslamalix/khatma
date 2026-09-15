import { AYAH_COUNTS, nextAyah, prevAyah } from './quran-meta';
import { ayahAudioUrl, firstStep, RECITERS, stepAfter } from './quran-audio.service';

describe('ayah navigation', () => {
  it('knows every surah length', () => {
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(6236);
  });

  it('crosses surah boundaries both ways', () => {
    expect(nextAyah({ surah: 1, ayah: 7 })).toEqual({ surah: 2, ayah: 1 });
    expect(prevAyah({ surah: 2, ayah: 1 })).toEqual({ surah: 1, ayah: 7 });
    expect(nextAyah({ surah: 114, ayah: 6 })).toBeNull();
    expect(prevAyah({ surah: 1, ayah: 1 })).toBeNull();
  });
});

describe('stepAfter', () => {
  const open = { from: { surah: 2, ayah: 1 }, to: null };

  it('recites the basmala before ayah 1, except Al-Fatiha and At-Tawbah', () => {
    expect(firstStep({ surah: 2, ayah: 1 }).basmala).toBe(true);
    expect(firstStep({ surah: 1, ayah: 1 }).basmala).toBe(false);
    expect(firstStep({ surah: 9, ayah: 1 }).basmala).toBe(false);
    expect(stepAfter(firstStep({ surah: 2, ayah: 1 }), open, 1, false)).toEqual({ ayah: { surah: 2, ayah: 1 }, iteration: 1, basmala: false });
  });

  it('repeats each ayah the chosen number of times', () => {
    const s = { ayah: { surah: 2, ayah: 5 }, iteration: 1, basmala: false };
    expect(stepAfter(s, open, 3, false)?.iteration).toBe(2);
    expect(stepAfter({ ...s, iteration: 3 }, open, 3, false)?.ayah).toEqual({ surah: 2, ayah: 6 });
  });

  it('continues into the next surah when unbounded', () => {
    const s = { ayah: { surah: 1, ayah: 7 }, iteration: 1, basmala: false };
    expect(stepAfter(s, { from: { surah: 1, ayah: 1 }, to: null }, 1, false)).toEqual(firstStep({ surah: 2, ayah: 1 }));
  });

  it('stops or loops at the end of a bounded range', () => {
    const range = { from: { surah: 18, ayah: 1 }, to: { surah: 18, ayah: 10 } };
    const last = { ayah: { surah: 18, ayah: 10 }, iteration: 1, basmala: false };
    expect(stepAfter(last, range, 1, false)).toBeNull();
    expect(stepAfter(last, range, 1, true)).toEqual(firstStep({ surah: 18, ayah: 1 }));
  });

  it('builds zero-padded everyayah URLs', () => {
    expect(ayahAudioUrl(RECITERS[0], { surah: 2, ayah: 255 })).toBe('https://everyayah.com/data/Alafasy_128kbps/002255.mp3');
  });
});
