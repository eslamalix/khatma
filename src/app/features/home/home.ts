import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdhkarToday } from '../../core/awrad/adhkar-today';
import { BUILTIN_ADHKAR } from '../../core/awrad/awrad-data';
import { ReadingStore } from '../../core/reading/reading.store';
import { daysAtWird, WIRD_PRESETS } from '../../core/reading/wird';
import { ar, counted, DAYS, hijriDate, hoursAndMinutes, MINUTES, ordinal, PAGES, percent, weekdayDate } from '../../core/format';
import { surahAtPage, surahName, TOTAL_PAGES } from '../../core/quran/quran-meta';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

const RING_R = 52;
const RING_C = 2 * Math.PI * RING_R;

/**
 * "Your day": today's wird first, the adhkar that are due, one thumb-reachable way back into the mushaf,
 * and the khatma told as encouragement (how little time is left) rather than as pressure.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, Sheet],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly store = inject(ReadingStore);
  private readonly adhkar = inject(AdhkarToday);
  protected readonly k = this.store.kpis;
  protected readonly wird = this.store.wird;
  protected readonly ar = ar;
  protected readonly percent = percent;
  protected readonly presets = WIRD_PRESETS;
  protected readonly ringC = RING_C;
  protected readonly ringR = RING_R;

  protected readonly greeting = new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير';
  protected readonly today = `${weekdayDate(Date.now())}، ${hijriDate(new Date())}`;

  protected readonly lastPage = computed(() => this.store.state().lastPage);
  protected readonly lastSurah = computed(() => surahName(surahAtPage(this.lastPage())));
  protected readonly hasStarted = computed(() => this.store.readings().length > 0);

  /** Minutes for `pages` at the reader's own pace. */
  private minutesFor(pages: number) {
    const min = Math.round((pages * this.k().avgMs) / 60_000);
    if (min < 1) return 'أقل من دقيقة';
    return min === 2 ? 'حوالي دقيقتين' : `حوالي ${counted(min, MINUTES)}`;
  }

  protected readonly ringOffset = computed(() => RING_C * (1 - (this.wird()?.ratio ?? 0)));
  protected readonly wirdTitle = computed(() => (this.wird()?.done ? 'أتممت وردك اليوم' : 'ورد اليوم'));
  protected readonly wirdSub = computed(() => {
    const w = this.wird();
    if (!w) return '';
    if (w.done) return w.read > w.goal ? `وزدت ${counted(w.read - w.goal, PAGES)}، بارك الله فيك` : 'بارك الله فيك';
    if (!w.read) return `${counted(w.goal, PAGES)}، ${this.minutesFor(w.goal)}`;
    return `باقي ${counted(w.remaining, PAGES)}، ${this.minutesFor(w.remaining)}`;
  });
  protected readonly streakText = computed(() => {
    const n = this.store.streak();
    return n >= 2 ? `${counted(n, DAYS)} متتالية` : '';
  });

  /** The morning or evening adhkar, only while it is their time and they are not yet done. */
  protected readonly dueAdhkar = computed(() => {
    const period = this.adhkar.periodNow();
    const cat = BUILTIN_ADHKAR.find((c) => c.id === period);
    return cat && !this.adhkar.doneToday().has(cat.id) ? cat : null;
  });

  protected readonly khatmaTitle = computed(() => `ختمتك ${ordinal(this.store.state().currentKhatma)}`);
  protected readonly khatmaDone = computed(() => 1 - this.k().remainingRatio);
  protected readonly pagesReadText = computed(() => `قرأت ${ar(this.k().pagesRead)} من ${ar(TOTAL_PAGES)} صفحة`);
  protected readonly remainingTimeText = computed(() => {
    const { hours, minutes } = hoursAndMinutes(this.k().remainingMs);
    return [hours, minutes].filter(Boolean).join(' و');
  });
  protected readonly finishText = computed(() => {
    const goal = this.store.state().dailyGoalPages;
    if (!goal) return '';
    return `بوردك تختمها خلال ${counted(daysAtWird(this.k().remainingPages, goal), DAYS)} بإذن الله.`;
  });

  protected readonly insight = this.store.insight;
  protected readonly insightText = computed(() => {
    const i = this.insight();
    if (!i?.change || Math.abs(i.change) < 0.03) return null;
    const pct = percent(Math.abs(i.change));
    return i.change > 0
      ? `قرأت سورة ${surahName(i.surah)} أسرع ${pct} من ختمتك السابقة`
      : `أخذت سورة ${surahName(i.surah)} وقتاً أطول ${pct} هذه المرة، والتأني حسن`;
  });

  // Choosing the daily wird
  protected readonly goalOpen = signal(false);
  protected readonly draftGoal = signal(5);
  protected readonly draftMinutes = computed(() => this.minutesFor(this.draftGoal()));
  protected readonly draftFinish = computed(() => counted(daysAtWird(TOTAL_PAGES, this.draftGoal()), DAYS));

  protected openGoal() {
    this.draftGoal.set(this.store.state().dailyGoalPages ?? 5);
    this.goalOpen.set(true);
  }

  protected stepGoal(delta: number) {
    this.draftGoal.update((g) => Math.min(60, Math.max(1, g + delta)));
  }

  /** Noun after a numeral: ٥ صفحات، ١٢ صفحة. */
  protected pagesNoun(n: number) {
    return n === 1 ? 'صفحة' : n === 2 ? 'صفحتان' : n % 100 >= 3 && n % 100 <= 10 ? 'صفحات' : 'صفحة';
  }

  protected presetLabel(pages: number) {
    return pages === 20 ? 'جزء تقريباً' : pages === 2 ? 'صفحتان' : 'صفحات';
  }

  protected presetMinutes(pages: number) {
    return this.minutesFor(pages);
  }

  protected saveGoal() {
    this.store.setDailyGoal(this.draftGoal());
    this.goalOpen.set(false);
  }
}
