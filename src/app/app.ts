import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon, IconName } from './ui/icon';
import { Sheet } from './ui/sheet';
import { ReadingStore } from './core/reading/reading.store';
import { RadioService } from './core/radio/radio.service';
import { Account } from './features/account/account';
import { RadioBar } from './features/radio/radio-bar';
import { Welcome } from './ui/welcome';
import { Onboarding } from './core/onboarding/onboarding';

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

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Sheet, Account, RadioBar, Welcome],
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
  readonly isHome = signal(true);
  private readonly radio = inject(RadioService);
  /** Home has the radio card itself; the mushaf keeps its bottom edge for the reader's own controls. */
  protected readonly showRadioBar = computed(() => this.radio.isActive() && !this.isHome() && !this.isQuran());

  constructor() {
    const track = (url: string) => {
      const path = url.split(/[?#]/)[0];
      this.isQuran.set(path.startsWith('/quran'));
      this.isHome.set(path === '/' || path === '');
    };
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) track(e.urlAfterRedirects);
    });
    track(this.router.url);
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
