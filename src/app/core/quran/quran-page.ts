export interface QuranAyah {
  surah: number;
  ayah: number;
  juz: number;
  /** Words of the ayah (pause marks stay attached to the word before them). */
  words: string[];
}

export interface QuranPage {
  page: number;
  ayahs: QuranAyah[];
}

interface ApiAyah {
  text: string;
  numberInSurah: number;
  juz: number;
  surah: { number: number };
}

const PAUSE_MARK = /^[ۖ-ۭؕ-ؚ]+$/;
const BASMALA_WORDS = 4;

/** Converts an api.alquran.cloud `quran-uthmani` page response into our page model. */
export function parseApiPage(page: number, ayahs: ApiAyah[]): QuranPage {
  return {
    page,
    ayahs: ayahs.map((a) => {
      let tokens = a.text.split(/\s+/).filter(Boolean);
      // The API prefixes the first ayah of each surah with the basmala; we render it as a separate line.
      if (a.numberInSurah === 1 && a.surah.number !== 1 && a.surah.number !== 9 && tokens[0]?.startsWith('بِسْمِ')) {
        tokens = tokens.slice(BASMALA_WORDS);
      }
      const words: string[] = [];
      for (const t of tokens) {
        if (PAUSE_MARK.test(t) && words.length) words[words.length - 1] += ` ${t}`;
        else words.push(t);
      }
      return { surah: a.surah.number, ayah: a.numberInSurah, juz: a.juz, words };
    }),
  };
}
