import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Reading, ReadingState } from '../reading/reading';
import { QuranPage } from '../quran/quran-page';

interface QuranKpiDb extends DBSchema {
  readings: { key: string; value: Reading; indexes: { bySynced: number } };
  pages: { key: number; value: QuranPage };
  kv: { key: string; value: ReadingState };
}

let dbPromise: Promise<IDBPDatabase<QuranKpiDb>> | null = null;

/** The device-local source of truth; the cloud is a copy of it. */
export function localDb() {
  dbPromise ??= openDB<QuranKpiDb>('quran-kpi', 1, {
    upgrade(db) {
      db.createObjectStore('readings', { keyPath: 'id' }).createIndex('bySynced', 'synced');
      db.createObjectStore('pages', { keyPath: 'page' });
      db.createObjectStore('kv');
    },
  });
  return dbPromise;
}
