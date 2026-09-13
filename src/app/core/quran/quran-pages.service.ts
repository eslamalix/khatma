import { Injectable } from '@angular/core';
import { localDb } from '../db/local-db';
import { TOTAL_PAGES } from './quran-meta';
import { parseApiPage, QuranPage } from './quran-page';

const API = 'https://api.alquran.cloud/v1/page';

/**
 * Loads mushaf pages, cached on the device after the first read.
 * Phase 1 source: Tanzil Uthmani text via api.alquran.cloud (docs/DECISIONS.md T6 plans a bundled word-level dataset).
 */
@Injectable({ providedIn: 'root' })
export class QuranPages {
  private readonly memory = new Map<number, Promise<QuranPage>>();

  get(page: number): Promise<QuranPage> {
    let pending = this.memory.get(page);
    if (!pending) {
      pending = this.load(page);
      this.memory.set(page, pending);
      pending.catch(() => this.memory.delete(page));
    }
    return pending;
  }

  /** Warm the cache around the reader's position so page turns are instant. */
  prefetch(page: number, radius = 2) {
    for (let p = page - radius; p <= page + radius; p++) {
      if (p >= 1 && p <= TOTAL_PAGES) this.get(p).catch(() => undefined);
    }
  }

  private async load(page: number): Promise<QuranPage> {
    const db = await localDb();
    const cached = await db.get('pages', page);
    if (cached) return cached;
    const res = await fetch(`${API}/${page}/quran-uthmani`);
    if (!res.ok) throw new Error(`page ${page}: ${res.status}`);
    const body = await res.json();
    const parsed = parseApiPage(page, body.data.ayahs);
    await db.put('pages', parsed);
    return parsed;
  }
}
