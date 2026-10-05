import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RadioService } from '../../core/radio/radio.service';
import { Icon } from '../../ui/icon';

/** Slim now-playing bar above the tab bar, so the radio can be stopped from any screen. */
@Component({
  selector: 'app-radio-bar',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'radio-bar', role: 'region', 'aria-label': 'الإذاعة' },
  template: `
    <span class="dot" [class.on]="radio.status() === 'playing'" aria-hidden="true"></span>
    <span class="text">
      <span class="name">إذاعة القرآن الكريم، {{ radio.station()?.name }}</span>
      <span class="sub">{{ radio.status() === 'playing' ? 'على الهواء' : radio.status() === 'error' ? 'تعذّر الاتصال' : 'جارٍ الاتصال…' }}</span>
    </span>
    <button type="button" class="stop" (click)="radio.stop()" aria-label="إيقاف الإذاعة">
      <app-icon name="stop" [size]="16" />
    </button>
  `,
  styles: `
    :host {
      position: fixed;
      z-index: 19;
      inset-inline: 12px;
      bottom: calc(var(--tabbar-h) + 8px);
      height: 52px;
      padding-inline: 14px 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-radius: 18px;
      background: var(--chrome);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--line);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      animation: rise 0.35s var(--ease);
    }
    @media (min-width: 768px) {
      :host {
        inset-inline: auto 24px;
        inset-inline-start: calc(var(--sidebar-w) + 24px);
        bottom: 20px;
        max-width: 420px;
      }
    }
    .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); }
    .dot.on { background: #d64535; animation: pulse 1.6s var(--ease) infinite; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sub { font-size: 12px; font-weight: 500; color: var(--ink-2); }
    .stop {
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--accent);
      color: var(--on-accent);
      transition: transform 0.15s var(--ease);
      &:active { transform: scale(0.9); }
    }
    @keyframes rise { from { transform: translateY(12px); opacity: 0; } }
    @keyframes pulse { 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { :host, .dot.on { animation: none; } }
  `,
})
export class RadioBar {
  protected readonly radio = inject(RadioService);
}
