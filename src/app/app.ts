import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Icon, IconName } from './ui/icon';
import { Sheet } from './ui/sheet';
import { ReadingStore } from './core/reading/reading.store';
import { RadioService } from './core/radio/radio.service';
import { Account } from './features/account/account';
import { RadioBar } from './features/radio/radio-bar';
import { Welcome } from './ui/welcome';
import { ThemeToggle } from './ui/theme-picker';
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

/** Read by the inline script in index.html; keep the two in step. */
const THEME_KEY = 'khatma.theme';

@Component({
  selector: 'app-root',
  imports: [ThemeToggle, RouterOutlet, RouterLink, RouterLinkActive, Icon, Sheet, Account, RadioBar, Welcome],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  // Start loading device data immediately so every screen opens populated.
  private readonly store = inject(ReadingStore);
  private readonly router = inject(Router);
  
  protected readonly onboarding = inject(Onboarding);
  private readonly storeReady = signal(false);
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
    void this.store.whenReady().then(() => {
      this.storeReady.set(true);
      this.onboarding.maybeWelcome(this.store.state().lastReadAt !== null);
    });
    // The chosen theme dresses every screen. Remembered on the device too, so index.html can put it on
    // before the app starts and a dark choice never flashes light.
    effect(() => {
      if (!this.storeReady()) return;
      const theme = this.store.state().backgroundTheme;
      document.documentElement.dataset['theme'] = theme;
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Only saves a flash on the next start.
      }
    });
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
