import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon, IconName } from './ui/icon';
import { Sheet } from './ui/sheet';
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
const TADABBUR: NavItem = { path: '/tadabbur', label: 'التدبر', icon: 'lamp' };
const STATS: NavItem = { path: '/stats', label: 'الإحصائيات', icon: 'stats' };
const CALENDAR: NavItem = { path: '/calendar', label: 'التقويم', icon: 'calendar' };
import { Account } from './features/account/account';
import { Welcome } from './ui/welcome';
import { Onboarding } from './core/onboarding/onboarding';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Sheet, Account, Welcome],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Start loading device data immediately so every screen opens populated.
  private readonly store = inject(ReadingStore);
  private readonly router = inject(Router);
  
  protected readonly onboarding = inject(Onboarding);
  readonly moreOpen = signal(false);
  readonly isQuran = signal(false);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.isQuran.set(e.urlAfterRedirects.startsWith('/quran'));
      }
    });
    this.isQuran.set(this.router.url.startsWith('/quran'));
    // A first open, before any reading: a short welcome.
    void this.store.whenReady().then(() => this.onboarding.maybeWelcome(this.store.state().lastReadAt !== null));
  }

  protected replayTour() {
    this.moreOpen.set(false);
    this.onboarding.replay();
  }

  /** Phone tab bar: 5 thumb-friendly ergonomic items (RTL: rightmost is HOME). */
  protected readonly tabs = [HOME, QURAN, AWRAD, GROUPS];
  protected readonly sidebar = [HOME, QURAN, TADABBUR, AWRAD, GROUPS, CALENDAR, STATS];

  protected readonly exactPath: IsActiveMatchOptions = { paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };
  protected readonly subtree: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };
}
