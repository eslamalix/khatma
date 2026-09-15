import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon, IconName } from './ui/icon';
import { ReadingStore } from './core/reading/reading.store';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
}

const HOME: NavItem = { path: '/', label: 'الرئيسية', icon: 'home' };
const QURAN: NavItem = { path: '/quran', label: 'القرآن', icon: 'quran' };
const GROUPS: NavItem = { path: '/groups', label: 'مجموعاتي', icon: 'collection' };
const AWRAD: NavItem = { path: '/awrad', label: 'الأوراد', icon: 'awrad' };
const STATS: NavItem = { path: '/stats', label: 'الإحصائيات', icon: 'stats' };
const CALENDAR: NavItem = { path: '/calendar', label: 'التقويم', icon: 'calendar' };

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Start loading device data immediately so every screen opens populated.
  private readonly store = inject(ReadingStore);

  /** Phone tab bar: 5 thumb-friendly ergonomic items (RTL: rightmost is HOME). */
  protected readonly tabs = [HOME, QURAN, AWRAD, GROUPS, CALENDAR];
  protected readonly sidebar = [HOME, QURAN, AWRAD, GROUPS, CALENDAR, STATS];

  protected readonly exactPath: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };
  protected readonly subtree: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };
}
