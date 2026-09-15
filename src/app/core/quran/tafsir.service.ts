import { Injectable } from '@angular/core';
import { localDb } from '../db/local-db';

const TAFSIR_API = 'https://api.alquran.cloud/v1/ayah';

/** Al-Muyassar tafsir per ayah, cached on the device after the first fetch. */
@Injectable({ providedIn: 'root' })
export class TafsirService {
  private readonly memoryCache = new Map<string, string>();

  async getTafsir(surah: number, ayah: number): Promise<string> {
    const key = `${surah}:${ayah}`;
    const inMem = this.memoryCache.get(key);
    if (inMem) return inMem;

    try {
      const cached = await (await localDb()).get('tafsir', key);
      if (cached) {
        this.memoryCache.set(key, cached);
        return cached;
      }
    } catch {
      // IndexedDB unavailable: fall through to the network.
    }

    try {
      const res = await fetch(`${TAFSIR_API}/${key}/ar.muyassar`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text: string | undefined = (await res.json())?.data?.text;
      if (!text) return 'تعذّر تحميل التفسير الميسر لهذه الآية.';
      this.memoryCache.set(key, text);
      localDb()
        .then((db) => db.put('tafsir', text, key))
        .catch(() => undefined);
      return text;
    } catch {
      return 'تعذّر الاتصال بالشبكة لتحميل التفسير. تأكد من اتصالك بالإنترنت.';
    }
  }
}
