import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ar, counted } from '../../core/format';
import { AYAH_COUNTS, surahName } from '../../core/quran/quran-meta';
import {
  AYAH_REPEATS,
  AyahRepeat,
  PLAYBACK_RATES,
  PlaybackRate,
  QuranAudioService,
  RECITERS,
} from '../../core/quran/quran-audio.service';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

const TIMES = ['مرة', 'مرتان', 'مرات', 'مرة'] as const;

/** Floating mini player while reciting, expanding into a sheet with reciter, repeat and speed. */
@Component({
  selector: 'app-quran-player',
  imports: [Icon, Sheet],
  templateUrl: './quran-player.html',
  styleUrl: './quran-player.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.visible]': 'audio.isActive()',
    '[attr.aria-hidden]': '!audio.isActive()',
  },
})
export class QuranPlayer {
  protected readonly audio = inject(QuranAudioService);
  protected readonly reciters = RECITERS;
  protected readonly rates = PLAYBACK_RATES;
  protected readonly repeats = AYAH_REPEATS;
  protected readonly ar = ar;

  readonly sheetOpen = signal(false);

  protected readonly title = computed(() => (this.audio.status() === 'error' ? 'تعذّر تحميل التلاوة' : this.audio.label()));
  protected readonly subtitle = computed(() =>
    this.audio.status() === 'error' ? 'تأكد من الاتصال ثم أعد المحاولة' : this.audio.reciter().name,
  );
  protected readonly busy = computed(() => this.audio.status() === 'loading');
  protected readonly surah = computed(() => surahName(this.audio.current()?.surah ?? 1));
  protected readonly position = computed(() => {
    const cur = this.audio.current();
    if (!cur) return '';
    return `آية ${ar(cur.ayah)} من ${ar(AYAH_COUNTS[cur.surah - 1])}`;
  });
  protected readonly rangeLabel = computed(() => {
    const r = this.audio.range();
    if (!r?.to) return '';
    if (r.from.surah === r.to.surah) return `${surahName(r.from.surah)}، الآيات ${ar(r.from.ayah)}–${ar(r.to.ayah)}`;
    return `${surahName(r.from.surah)} ${ar(r.from.ayah)} – ${surahName(r.to.surah)} ${ar(r.to.ayah)}`;
  });
  protected readonly repeatInfo = computed(() => {
    const s = this.audio.step();
    const n = this.audio.repeat();
    return s && n > 1 ? `التكرار ${ar(s.iteration)} من ${ar(n)}` : '';
  });

  open() {
    this.sheetOpen.set(true);
  }

  protected rateLabel(rate: PlaybackRate) {
    return `${ar(String(rate).replace('.', '٫'))}×`;
  }

  protected repeatLabel(n: AyahRepeat) {
    return counted(n, TIMES);
  }

  protected stop() {
    this.sheetOpen.set(false);
    this.audio.stop();
  }
}
