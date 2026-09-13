import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { ReadingStore } from '../../core/reading/reading.store';
import { PageRow } from '../../core/reading/kpi';
import { ar, dayMonth, minSec, ordinal, percent, shortDuration, timeOfDay } from '../../core/format';
import { JUZ_START_PAGES, SURAH_NAMES, surahName } from '../../core/quran/quran-meta';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

type Filter = 'all' | 'surah' | 'juz';

interface RowView {
  page: string;
  pageNo: number;
  surah: string;
  juz: string;
  state: 'read' | 'last' | 'unread';
  start: string;
  end: string;
  range: string;
  date: string;
  duration: string;
  best: string;
  change: string;
  faster: boolean;
}

@Component({
  selector: 'app-stats',
  imports: [ScrollingModule, Icon, Sheet],
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stats {
  protected readonly store = inject(ReadingStore);
  protected readonly ar = ar;
  private readonly k = this.store.kpis;

  protected readonly avg = computed(() => minSec(this.k().avgMs));
  protected readonly khatmaPages = computed(() => ar(this.k().pagesRead));
  protected readonly total = computed(() => shortDuration(this.k().totalReadMs));
  protected readonly khatmaTitle = computed(() => ordinal(this.store.state().currentKhatma));
  protected readonly nextKhatmaTitle = computed(() => ordinal(this.store.state().currentKhatma + 1));

  protected readonly improvement = computed(() => {
    const i = this.store.insight();
    if (!i || i.change === undefined || i.previousMs === undefined) return null;
    const faster = i.change >= 0;
    return {
      title: `قرأت ${surahName(i.surah)} ${faster ? 'أسرع' : 'أبطأ'} بـ ${percent(Math.abs(i.change))}`,
      detail: `${shortDuration(i.durationMs)} هذه الختمة، مقابل ${shortDuration(i.previousMs)} في الختمة السابقة`,
      faster,
    };
  });

  protected readonly filter = signal<Filter>('all');
  protected readonly surahFilter = signal(1);
  protected readonly juzFilter = signal(1);
  protected readonly surahOptions = SURAH_NAMES.map((name, i) => ({ value: i + 1, label: `${ar(i + 1)}. ${name}` }));
  protected readonly juzOptions = JUZ_START_PAGES.map((_, i) => ({ value: i + 1, label: `الجزء ${ar(i + 1)}` }));

  protected readonly rows = computed<RowView[]>(() => {
    const lastPage = this.store.state().lastPage;
    const f = this.filter();
    return this.store
      .rows()
      .filter((r) => (f === 'surah' ? r.surah === this.surahFilter() : f === 'juz' ? r.juz === this.juzFilter() : true))
      .map((r) => toView(r, lastPage));
  });

  protected readonly confirmOpen = signal(false);
  protected readonly trackRow = (_: number, r: RowView) => r.pageNo;

  protected setFilter(f: Filter) {
    this.filter.set(f);
  }

  protected pick(event: Event) {
    const value = +(event.target as HTMLSelectElement).value;
    if (this.filter() === 'surah') this.surahFilter.set(value);
    else this.juzFilter.set(value);
  }

  protected startNewKhatma() {
    this.store.startNewKhatma();
    this.confirmOpen.set(false);
  }
}

function toView(r: PageRow, lastPage: number): RowView {
  const c = r.current;
  const start = c ? timeOfDay(c.startAt) : '';
  const end = c ? timeOfDay(c.endAt) : '';
  return {
    page: ar(r.page),
    pageNo: r.page,
    surah: surahName(r.surah),
    juz: ar(r.juz),
    state: c ? 'read' : r.page === lastPage ? 'last' : 'unread',
    start,
    end,
    range: c ? compactRange(start, end) : '',
    date: c ? dayMonth(c.startAt) : '',
    duration: c ? minSec(c.durationMs) : '—',
    best: r.bestMs !== undefined ? minSec(r.bestMs) : '—',
    change: r.change === undefined ? '' : `${r.change >= 0 ? 'أسرع' : 'أبطأ'} ${percent(Math.abs(r.change))}`,
    faster: (r.change ?? 0) >= 0,
  };
}

/** "٩:١٤ م" + "٩:١٥ م" → "٩:١٤ – ٩:١٥ م" */
function compactRange(start: string, end: string) {
  const [sTime, sPeriod] = start.split(' ');
  const [eTime, ePeriod] = end.split(' ');
  return sPeriod === ePeriod ? `${sTime} – ${eTime} ${ePeriod ?? ''}`.trim() : `${start} – ${end}`;
}
