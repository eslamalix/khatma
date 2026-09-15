import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Reading, ReadingState } from '../reading/reading';
import { QuranPage } from '../quran/quran-page';

interface QuranKpiDb extends DBSchema {
  readings: { key: string; value: Reading; indexes: { bySynced: number } };
  pages: { key: number; value: QuranPage };
  kv: { key: string; value: ReadingState };
  /** Tafsir text by "surah:ayah", fetched once then kept for offline reading. */
  tafsir: { key: string; value: string };
}

let dbPromise: Promise<IDBPDatabase<QuranKpiDb>> | null = null;

/** The device-local source of truth; the cloud is a copy of it. */
export function localDb() {
  dbPromise ??= openDB<QuranKpiDb>('quran-kpi', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('readings', { keyPath: 'id' }).createIndex('bySynced', 'synced');
        db.createObjectStore('pages', { keyPath: 'page' });
        db.createObjectStore('kv');
      }
      if (oldVersion < 2) db.createObjectStore('tafsir');
    },
  });
  return dbPromise;
}
