import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReadingStore } from '../../core/reading/reading.store';
import { daysToFinish } from '../../core/reading/kpi';
import { ar, clock, counted, DAYS, hoursAndMinutes, MINUTES, minSec, ordinal, PAGES, percent, weekdayDate } from '../../core/format';
import { surahAtPage, surahName } from '../../core/quran/quran-meta';

const COUNT_UP_MS = 1100;

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly store = inject(ReadingStore);
  protected readonly k = this.store.kpis;
  protected readonly ar = ar;
  protected readonly percent = percent;

  protected readonly today = weekdayDate(Date.now());

  /** Khatma time animates up from zero on arrival, then follows the data. */
  private readonly progress = signal(0);
  protected readonly shownKhatmaMs = computed(() => this.k().khatmaMs * this.progress());
  protected readonly counterParts = computed(() => clock(this.shownKhatmaMs()).split(':'));
  protected readonly khatmaWords = computed(() => hoursAndMinutes(this.shownKhatmaMs()));
  protected readonly remainingClock = computed(() => clock(this.k().remainingMs * this.progress()));
  protected readonly avgText = computed(() => {
    const secs = Math.round(this.k().avgMs / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (!m) return counted(s, ['ثانية', 'ثانيتان', 'ثوانٍ', 'ثانية']);
    return s ? `${counted(m, MINUTES)} و${counted(s, ['ثانية', 'ثانيتان', 'ثوانٍ', 'ثانية'])}` : counted(m, MINUTES);
  });
  protected readonly khatmaOrdinal = computed(() => ordinal(this.store.state().currentKhatma));
  protected readonly pagesReadText = computed(() => `${ar(this.k().pagesRead)} من ${ar(604)} صفحة`);
  protected readonly pagesLeftText = computed(() => `${counted(this.k().remainingPages, PAGES)} متبقية`);
  protected readonly lastPage = computed(() => this.store.state().lastPage);
  protected readonly lastSurah = computed(() => surahName(surahAtPage(this.lastPage())));
  protected readonly hasStarted = computed(() => this.store.readings().length > 0);

  protected readonly insight = this.store.insight;
  protected readonly insightMinutes = computed(() => {
    const i = this.insight();
    return i ? Math.max(1, Math.round(i.durationMs / 60_000)) : 0;
  });
  protected readonly insightMinutesText = computed(() => counted(this.insightMinutes(), MINUTES));
  protected readonly insightSurah = computed(() => surahName(this.insight()?.surah ?? 0));
  protected readonly insightDays = computed(() => counted(daysToFinish(this.k().khatmaMs, this.insightMinutes()), DAYS));

  protected readonly dailyMinutes = signal(30);
  protected readonly dailyMinutesText = computed(() => counted(this.dailyMinutes(), MINUTES));
  protected readonly dailyDaysText = computed(() => counted(daysToFinish(this.k().khatmaMs, this.dailyMinutes()), DAYS));
  protected readonly sliderFill = computed(() => `${((this.dailyMinutes() - 5) / 115) * 100}%`);
  protected readonly minSec = minSec;

  constructor() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => cancelAnimationFrame(frame));
    effect(() => {
      if (!this.store.ready() || reduce) return this.progress.set(1);
      const start = performance.now();
      const step = (t: number) => {
        const x = Math.min(1, (t - start) / COUNT_UP_MS);
        this.progress.set(1 - Math.pow(1 - x, 3));
        if (x < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    });
  }

  protected setDaily(event: Event) {
    this.dailyMinutes.set(+(event.target as HTMLInputElement).value);
  }
}
