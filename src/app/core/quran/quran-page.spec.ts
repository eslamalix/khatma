import { parseApiPage } from './quran-page';

const ayah = (surah: number, numberInSurah: number, text: string) => ({ surah: { number: surah }, numberInSurah, juz: 1, text });

describe('parseApiPage', () => {
  it('moves the basmala out of the first ayah of a surah', () => {
    const page = parseApiPage(50, [ayah(3, 1, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ')]);
    expect(page.ayahs[0].words).toEqual(['الٓمٓ']);
  });

  it('keeps Al-Fatiha ayah 1, which is the basmala itself', () => {
    const page = parseApiPage(1, [ayah(1, 1, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')]);
    expect(page.ayahs[0].words).toHaveLength(4);
  });

  it('attaches pause marks to the word before them', () => {
    const page = parseApiPage(2, [ayah(2, 2, 'ذَٰلِكَ ٱلْكِتَٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًۭى لِّلْمُتَّقِينَ')]);
    expect(page.ayahs[0].words).toEqual(['ذَٰلِكَ', 'ٱلْكِتَٰبُ', 'لَا', 'رَيْبَ ۛ', 'فِيهِ ۛ', 'هُدًۭى', 'لِّلْمُتَّقِينَ']);
  });
});
