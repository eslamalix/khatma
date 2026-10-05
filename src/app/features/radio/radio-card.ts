import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RadioService } from '../../core/radio/radio.service';
import { Icon } from '../../ui/icon';

/** Home card: both Quran radio stations, each one tap from playing. */
@Component({
  selector: 'app-radio-card',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card radio" aria-labelledby="radio-title">
      <header class="head">
        <span class="mark"><app-icon name="radio" [size]="20" [stroke]="1.9" /></span>
        <h2 id="radio-title" class="title">إذاعة القرآن الكريم</h2>
        <span class="live" [class.on]="radio.status() === 'playing'">
          <i aria-hidden="true"></i>{{ radio.status() === 'playing' ? 'على الهواء' : 'بث مباشر' }}
        </span>
      </header>
      <div class="stations" role="group" aria-label="اختر الإذاعة">
        @for (s of radio.stations; track s.id) {
          @let on = radio.station()?.id === s.id && radio.isActive();
          <button type="button" class="station" [class.on]="on" [attr.aria-pressed]="on" (click)="radio.toggle(s)"
            [attr.aria-label]="(on && radio.status() !== 'error' ? 'إيقاف ' : 'تشغيل ') + s.title">
            <span class="btn">
              @if (on && radio.status() === 'loading') {
                <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
              } @else if (on && radio.status() === 'playing') {
                <app-icon name="stop" [size]="18" />
              } @else if (on && radio.status() === 'error') {
                <app-icon name="refresh" [size]="18" [stroke]="2.2" />
              } @else {
                <app-icon name="play" [size]="20" />
              }
            </span>
            <span class="text">
              <span class="name">{{ s.name }}</span>
              <span class="sub">{{ on ? stateText() : s.place }}</span>
            </span>
          </button>
        }
      </div>
    </section>
  `,
  styleUrl: './radio-card.scss',
})
export class RadioCard {
  protected readonly radio = inject(RadioService);

  protected stateText() {
    switch (this.radio.status()) {
      case 'loading':
        return 'جارٍ الاتصال…';
      case 'error':
        return 'تعذّر الاتصال، اضغط للمحاولة';
      default:
        return 'يُبث الآن';
    }
  }
}
