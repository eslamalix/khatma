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
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  play: '<path d="M8 5.8v12.4a.9.9 0 0 0 1.36.77l10.1-6.2a.9.9 0 0 0 0-1.54L9.36 5.03A.9.9 0 0 0 8 5.8z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" stroke="none"/>',
  skipLeft: '<path d="M17.5 6.6v10.8a.8.8 0 0 1-1.24.67L8.9 12.67a.8.8 0 0 1 0-1.34l7.36-5.4a.8.8 0 0 1 1.24.67z" fill="currentColor" stroke="none"/><rect x="5.5" y="6" width="2.2" height="12" rx="1.1" fill="currentColor" stroke="none"/>',
  skipRight: '<path d="M6.5 6.6v10.8a.8.8 0 0 0 1.24.67l7.36-5.4a.8.8 0 0 0 0-1.34L7.74 5.93A.8.8 0 0 0 6.5 6.6z" fill="currentColor" stroke="none"/><rect x="16.3" y="6" width="2.2" height="12" rx="1.1" fill="currentColor" stroke="none"/>',
  headphones: '<path d="M4 16v-4a8 8 0 0 1 16 0v4"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.6"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.6"/>',
  repeat: '<path d="M16.5 3l3 3-3 3"/><path d="M4.5 11V9.5A3.5 3.5 0 0 1 8 6h11.5"/><path d="M7.5 21l-3-3 3-3"/><path d="M19.5 13v1.5A3.5 3.5 0 0 1 16 18H4.5"/>',
  chevronUp: '<path d="M7 14l5-5 5 5"/>',
  more: '<circle cx="5.5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  grip: '<circle cx="9" cy="6.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="6.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="9" cy="17.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="17.5" r="1.4" fill="currentColor" stroke="none"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7"/><path d="M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6.2 7.5-6.2s6.7 2.2 7.5 6.2"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  collection:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
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
