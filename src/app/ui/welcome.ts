import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Onboarding } from '../core/onboarding/onboarding';
import { Icon, IconName } from './icon';

interface Slide {
  icon: IconName;
  title: string;
  text: string;
}

const SLIDES: readonly Slide[] = [
  {
    icon: 'quran',
    title: 'أهلاً بك في ختمة',
    text: 'رفيقك اليومي مع القرآن. يقيس وقت قراءتك الحقيقي، فيصير ختم القرآن دقائق واضحة كل يوم.',
  },
  {
    icon: 'bolt',
    title: 'اقرأ فقط، والباقي علينا',
    text: 'افتح المصحف واقرأ. الوقت يُحسب وحده لكل صفحة ويتوقف إن تركت الجهاز. اختر وردك اليومي بالصفحات وتابع تقدّمك.',
  },
  {
    icon: 'lamp',
    title: 'تدبّر، واذكر، واحفظ',
    text: 'اجمع آيات في بطاقات تدبّر واكتب تأملك، وأذكار الصباح والمساء مع المسبحة، ومجموعات آيات للتحصين والرقية.',
  },
];

/** First open only (and "جولة التطبيق"): three short cards on what the app is and how it works. */
@Component({
  selector: 'app-welcome',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'مرحباً بك',
    '(document:keydown.escape)': 'finish()',
  },
  template: `
    <div class="panel">
      <button type="button" class="skip" (click)="finish()">تخطَّ</button>
      <div #track class="track" (scroll)="onScroll()">
        @for (s of slides; track s.title) {
          <section class="slide">
            <span class="art"><app-icon [name]="s.icon" [size]="44" [stroke]="1.6" /></span>
            <h2>{{ s.title }}</h2>
            <p>{{ s.text }}</p>
          </section>
        }
      </div>
      <footer>
        <div class="dots" aria-hidden="true">
          @for (s of slides; track s.title; let i = $index) {
            <span [class.on]="i === index()"></span>
          }
        </div>
        <p class="note">بدون تسجيل دخول، وبياناتك محفوظة على جهازك.</p>
        <button type="button" class="next" (click)="next()">
          {{ index() === slides.length - 1 ? 'ابدأ' : 'التالي' }}
        </button>
      </footer>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: grid;
      place-items: center;
      /* One column as wide as the screen, not as wide as all the slides side by side. */
      grid-template-columns: minmax(0, 1fr);
      background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(10px);
      animation: fade 0.3s var(--ease);
    }
    .panel {
      position: relative;
      width: 100%;
      min-width: 0;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: calc(12px + env(safe-area-inset-top)) 0 calc(20px + env(safe-area-inset-bottom));
      background: var(--bg);
    }
    .skip {
      position: absolute;
      top: calc(12px + env(safe-area-inset-top));
      inset-inline-end: 16px;
      z-index: 1;
      height: 36px;
      padding: 0 14px;
      border-radius: 18px;
      color: var(--ink-2);
      font-size: 14px;
      font-weight: 600;
    }
    .track {
      flex: 1;
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
    }
    .track::-webkit-scrollbar {
      display: none;
    }
    .slide {
      flex: 0 0 100%;
      scroll-snap-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 14px;
      padding: 0 32px;
      text-align: center;
    }
    .art {
      width: 104px;
      height: 104px;
      border-radius: 32px;
      display: grid;
      place-items: center;
      margin-bottom: 10px;
      color: var(--accent);
      background: var(--accent-soft);
    }
    h2 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    p {
      margin: 0;
      max-width: 340px;
      font-size: 16px;
      line-height: 1.9;
      color: var(--ink-2);
    }
    footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 0 24px;
    }
    .dots {
      display: flex;
      gap: 7px;
    }
    .dots span {
      width: 7px;
      height: 7px;
      border-radius: 4px;
      background: var(--track);
      transition:
        width 0.3s var(--ease),
        background 0.3s;
    }
    .dots span.on {
      width: 22px;
      background: var(--accent);
    }
    .note {
      font-size: 12.5px;
      color: var(--ink-3);
    }
    .next {
      width: 100%;
      max-width: 360px;
      height: 52px;
      border-radius: 16px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 16px;
      font-weight: 700;
    }
    @media (min-width: 768px) {
      .panel {
        width: min(460px, 92vw);
        height: min(620px, 90vh);
        border-radius: 28px;
        background: var(--card);
        box-shadow: var(--shadow-float);
        padding-top: 16px;
      }
      .skip {
        top: 16px;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `,
})
export class Welcome {
  private readonly onboarding = inject(Onboarding);
  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  protected readonly slides = SLIDES;
  protected readonly index = signal(0);

  /** Slide a "التالي" scroll is heading to; scroll events on the way there must not pull the index back. */
  private goingTo: number | null = null;

  protected onScroll() {
    const el = this.track().nativeElement;
    const at = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (this.goingTo !== null) {
      if (at !== this.goingTo) return;
      this.goingTo = null;
    }
    this.index.set(at);
  }

  protected next() {
    const i = this.index();
    if (i >= SLIDES.length - 1) {
      this.finish();
      return;
    }
    const el = this.track().nativeElement;
    // RTL: the next slide lies to the left.
    this.goingTo = i + 1;
    this.index.set(i + 1);
    el.scrollTo({ left: -(i + 1) * el.clientWidth, behavior: 'smooth' });
  }

  protected finish() {
    this.onboarding.finishWelcome();
  }
}
