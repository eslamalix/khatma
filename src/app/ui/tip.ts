import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon, IconName } from './icon';

export interface TipLine {
  icon: IconName;
  text: string;
}

/** A one-time hint card: a title, a few short lines each with its icon, and "فهمت". */
@Component({
  selector: 'app-tip',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'dialog', '[attr.aria-label]': 'title()' },
  template: `
    <h3>{{ title() }}</h3>
    <ul>
      @for (line of lines(); track line.text) {
        <li>
          <span class="i"><app-icon [name]="line.icon" [size]="17" [stroke]="1.9" /></span>
          <span>{{ line.text }}</span>
        </li>
      }
    </ul>
    <button type="button" (click)="dismissed.emit()">فهمت</button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 16px 12px;
      border-radius: 22px;
      background: var(--card);
      color: var(--ink);
      border: 1px solid var(--line);
      box-shadow:
        0 14px 40px rgba(0, 0, 0, 0.18),
        0 2px 6px rgba(0, 0, 0, 0.06);
      animation: tipIn 0.3s var(--ease);
    }
    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 14px;
      line-height: 1.7;
      color: var(--ink-2);
    }
    .i {
      flex: none;
      width: 30px;
      height: 30px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      background: var(--accent-soft);
      color: var(--accent);
    }
    button {
      align-self: flex-end;
      height: 38px;
      padding: 0 20px;
      border-radius: 19px;
      background: var(--accent);
      color: var(--on-accent);
      font-size: 14px;
      font-weight: 700;
    }
    @keyframes tipIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: none;
      }
    }
  `,
})
export class Tip {
  readonly title = input.required<string>();
  readonly lines = input.required<readonly TipLine[]>();
  readonly dismissed = output<void>();
}
