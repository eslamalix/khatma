import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReadingStore } from '../core/reading/reading.store';
import { BackgroundTheme } from '../core/reading/reading';
import { Icon } from './icon';

const THEMES: { id: BackgroundTheme; name: string; preview: string }[] = [
  { id: 'auto', name: 'تلقائي', preview: 'linear-gradient(135deg, #faf6ec 50%, #161512 50%)' },
  { id: 'cream', name: 'كريمي', preview: '#faf6ec' },
  { id: 'white', name: 'أبيض', preview: '#ffffff' },
  { id: 'dark', name: 'داكن', preview: '#161512' },
];

/** The app's theme (every screen, and the mushaf's page colour). "Auto" follows the device. */
@Component({
  selector: 'app-theme-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="theme-grid" role="radiogroup" aria-label="المظهر">
      @for (t of themes; track t.id) {
        <button type="button" class="theme-swatch" role="radio" [attr.aria-checked]="current() === t.id"
          [class.active]="current() === t.id" (click)="store.setBackgroundTheme(t.id)">
          <span class="swatch-preview" [style.background]="t.preview"></span>
          <span class="swatch-name">{{ t.name }}</span>
          @if (current() === t.id) {
            <span class="swatch-check"><app-icon name="check" [size]="14" [stroke]="2.5" /></span>
          }
        </button>
      }
    </div>
  `,
})
export class ThemePicker {
  protected readonly store = inject(ReadingStore);
  protected readonly themes = THEMES;
  protected readonly current = computed(() => this.store.state().backgroundTheme);
}

const LIGHT_KEY = 'khatma.theme.light';
const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * One tap between light and dark, on every screen beside the account button: a sun or a moon is understood
 * at a glance, with no menu to find. Coming back from dark restores the light page the reader had chosen
 * (cream or white); the full choice, "auto" included, is in the appearance pickers.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" (click)="toggle()"
      [attr.aria-label]="dark() ? 'الوضع الفاتح' : 'الوضع الداكن'" [attr.title]="dark() ? 'الوضع الفاتح' : 'الوضع الداكن'">
      <app-icon [name]="dark() ? 'sun' : 'moon'" [size]="20" [stroke]="1.9" />
    </button>
  `,
  styles: `
    :host { display: contents; }
    .toggle {
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: var(--fill);
      color: var(--ink-2);
      border: 1.5px solid var(--line);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      transition: transform 0.15s var(--ease), border-color 0.2s;
      &:hover { border-color: var(--accent); color: var(--accent); }
      &:active { transform: scale(0.94); }
    }
  `,
})
export class ThemeToggle {
  private readonly store = inject(ReadingStore);
  private readonly theme = computed(() => this.store.state().backgroundTheme);
  protected readonly dark = computed(() => this.theme() === 'dark' || (this.theme() === 'auto' && systemDark()));

  protected toggle() {
    const current = this.theme();
    if (!this.dark()) {
      if (current === 'cream' || current === 'white') {
        try {
          localStorage.setItem(LIGHT_KEY, current);
        } catch {
          // Only which light page comes back.
        }
      }
      this.store.setBackgroundTheme('dark');
      return;
    }
    let light: BackgroundTheme = 'cream';
    try {
      if (localStorage.getItem(LIGHT_KEY) === 'white') light = 'white';
    } catch {
      // Cream, the default light page.
    }
    this.store.setBackgroundTheme(light);
  }
}
