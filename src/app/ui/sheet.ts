import { ChangeDetectionStrategy, Component, effect, ElementRef, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

/** Bottom sheet on phones, centered panel on larger screens. */
@Component({
  selector: 'app-sheet',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.open]': 'open()', '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    <div class="backdrop" (click)="closed.emit()"></div>
    <section #panel class="panel" role="dialog" aria-modal="true" [attr.aria-label]="title()" tabindex="-1">
      <header>
        <h2>{{ title() }}</h2>
        <button type="button" class="close" (click)="closed.emit()" aria-label="إغلاق"><app-icon name="close" [size]="18" [stroke]="2" /></button>
      </header>
      <ng-content />
    </section>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 50; pointer-events: none; }
    .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.32); opacity: 0; transition: opacity .3s var(--ease); }
    .panel {
      position: absolute; inset-inline: 0; bottom: 0; max-height: 82dvh; overflow: auto;
      padding: 8px 20px calc(20px + env(safe-area-inset-bottom));
      background: var(--card); border-radius: 22px 22px 0 0; box-shadow: var(--shadow-float);
      transform: translateY(100%); transition: transform .38s var(--ease); outline: none;
    }
    .panel::before { content: ''; display: block; width: 38px; height: 5px; border-radius: 3px; background: var(--track); margin: 0 auto 6px; }
    header { display: flex; align-items: center; justify-content: space-between; height: 44px; }
    h2 { margin: 0; font-size: 18px; font-weight: 700; }
    .close { width: 32px; height: 32px; border-radius: 16px; display: grid; place-items: center; background: var(--fill); color: var(--ink-2); }
    :host(.open) { pointer-events: auto; }
    :host(.open) .backdrop { opacity: 1; }
    :host(.open) .panel { transform: none; }
    @media (min-width: 768px) {
      .panel { inset: auto; top: 50%; left: 50%; bottom: auto; width: min(480px, 92vw); border-radius: 22px;
        transform: translate(-50%, -46%) scale(.97); opacity: 0; transition: transform .3s var(--ease), opacity .2s; padding-bottom: 20px; }
      .panel::before { display: none; }
      :host(.open) .panel { transform: translate(-50%, -50%); opacity: 1; }
    }
  `,
})
export class Sheet {
  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => {
      if (this.open()) queueMicrotask(() => this.panel().nativeElement.focus({ preventScroll: true }));
    });
  }
}
