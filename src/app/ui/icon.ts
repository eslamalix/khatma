import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

const PATHS = {
  quran: '<path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
  awrad: '<circle cx="12" cy="4" r="1.5"/><circle cx="16.95" cy="6.05" r="1.5"/><circle cx="19" cy="11" r="1.5"/><circle cx="16.95" cy="15.95" r="1.5"/><circle cx="7.05" cy="6.05" r="1.5"/><circle cx="5" cy="11" r="1.5"/><circle cx="7.05" cy="15.95" r="1.5"/><circle cx="12" cy="18" r="1.5"/><path d="M12 19.5V22"/>',
  home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  stats: '<path d="M5.5 20v-7M12 20V5M18.5 20v-9.5"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  chevronLeft: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9.5 6l6 6-6 6"/>',
  chevronDown: '<path d="M7 10l5 5 5-5"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  textSize: '<path d="M4 18l4.5-12L13 18M5.8 14h5.4M15 18l3-8 3 8M16 15.5h4"/>',
  plus: '<path d="M12 6v12M6 12h12"/>',
  minus: '<path d="M6 12h12"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  refresh: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display:inline-flex' },
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" [innerHTML]="markup()"></svg>`,
})
export class Icon {
  private readonly sanitizer = inject(DomSanitizer);
  readonly name = input.required<IconName>();
  readonly size = input(24);
  readonly stroke = input(1.7);
  // Static, trusted path data from the table above.
  protected readonly markup = computed(() => this.sanitizer.bypassSecurityTrustHtml(PATHS[this.name()]));
}
