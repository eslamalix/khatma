import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Placeholder for screens scheduled in phase 2 (docs/DECISIONS.md §3). */
@Component({
  selector: 'app-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <h1 class="large-title">{{ title() }}</h1>
      <div class="card empty">
        <span class="tag">قريباً</span>
        <p>{{ text() }}</p>
      </div>
    </div>
  `,
  styles: `
    .page { max-width: 720px; margin: 0 auto; padding: max(58px, env(safe-area-inset-top)) 20px 24px; display: flex; flex-direction: column; gap: 16px; }
    @media (min-width: 768px) { .page { padding: 36px 56px; margin: 0; } }
    .empty { padding: 28px 24px; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .tag { font-size: 12.5px; font-weight: 600; color: var(--accent); background: var(--accent-soft); padding: 3px 10px; border-radius: 20px; }
    p { margin: 0; font-size: 16px; line-height: 1.7; color: var(--ink-2); }
  `,
})
export class Soon {
  readonly title = input('');
  readonly text = input('');
}
