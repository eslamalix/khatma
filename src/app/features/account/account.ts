import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CloudSync } from '../../core/sync/cloud-sync';
import packageJson from '../../../../package.json';
import { Icon } from '../../ui/icon';
import { Sheet } from '../../ui/sheet';

/** Avatar button + sheet: keep the khatmas in a Google account, or see which account they are in. */
@Component({
  selector: 'app-account',
  imports: [Icon, Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="avatar-btn" (click)="open.set(true)" [attr.aria-label]="signedIn() ? 'حسابك' : 'احفظ بياناتك في حساب'">
      @if (account()?.photoUrl; as photo) {
        <img [src]="photo" alt="" referrerpolicy="no-referrer" />
      } @else if (signedIn()) {
        <span class="initial">{{ initial() }}</span>
      } @else {
        <app-icon name="user" [size]="22" [stroke]="1.8" />
      }
    </button>

    <app-sheet [open]="open()" [title]="signedIn() ? 'حسابك' : 'احفظ ختماتك'" (closed)="open.set(false)">
      <div class="account">
        @if (signedIn()) {
          <div class="who">
            @if (account()?.photoUrl; as photo) {
              <img class="who-photo" [src]="photo" alt="" referrerpolicy="no-referrer" />
            } @else {
              <span class="who-photo initial">{{ initial() }}</span>
            }
            <span class="who-text">
              <span class="who-name">{{ account()?.name || 'حساب Google' }}</span>
              <span class="who-email" dir="ltr">{{ account()?.email }}</span>
            </span>
          </div>
          <p class="note ok"><app-icon name="check" [size]="16" [stroke]="2.4" /> ختماتك وقراءاتك محفوظة في حسابك، وتفتحها من أي جهاز.</p>
          <button type="button" class="secondary" (click)="signOut()" [disabled]="cloud.busy()">تسجيل الخروج</button>
          <p class="fine">بعد الخروج تبقى بياناتك على هذا الجهاز.</p>
        } @else {
          <p class="lead">قراءاتك الآن محفوظة على هذا الجهاز فقط. سجّل الدخول بحساب Google لتبقى في أمان، وتكمل ختمتك من أي جهاز.</p>
          <button type="button" class="google" (click)="signIn()" [disabled]="cloud.busy() || cloud.status() === 'offline'">
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span>{{ cloud.busy() ? 'جارٍ تسجيل الدخول…' : 'المتابعة بحساب Google' }}</span>
          </button>
          @if (cloud.status() === 'offline') {
            <p class="fine">تسجيل الدخول يحتاج اتصالاً بالإنترنت.</p>
          }
          <p class="fine">لن يُنشر شيء باسمك، ولا يرى قراءاتك أحد غيرك.</p>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <p class="fine version-text" dir="ltr" style="text-align: center; margin-top: 2rem; opacity: 0.5;">v{{ version }}</p>
      </div>
    </app-sheet>
  `,
  styles: `
    :host { display: contents; }
    .avatar-btn {
      flex: none; width: 44px; height: 44px; border-radius: 22px; overflow: hidden;
      display: grid; place-items: center; background: var(--fill); color: var(--ink-2);
      img { width: 100%; height: 100%; object-fit: cover; }
    }
    .initial { font-size: 18px; font-weight: 700; color: var(--accent); }
    .account { display: flex; flex-direction: column; gap: 12px; padding: 8px 0 4px; }
    .lead { margin: 0; font-size: 15.5px; line-height: 1.7; color: var(--ink); }
    .google {
      height: 54px; border-radius: 16px; display: flex; align-items: center; justify-content: center; gap: 10px;
      background: var(--card); color: var(--ink); border: 1px solid var(--line);
      box-shadow: 0 1px 2px rgba(0,0,0,.06); font-size: 16px; font-weight: 600;
      &:disabled { opacity: .55; }
    }
    .who { display: flex; align-items: center; gap: 12px; }
    .who-photo { width: 52px; height: 52px; border-radius: 26px; object-fit: cover; display: grid; place-items: center; background: var(--accent-soft); }
    .who-text { min-width: 0; display: flex; flex-direction: column; }
    .who-name { font-size: 17px; font-weight: 700; }
    .who-email { font-size: 13.5px; color: var(--ink-2); text-align: start; overflow: hidden; text-overflow: ellipsis; }
    .note { margin: 0; display: flex; gap: 6px; align-items: flex-start; font-size: 14.5px; line-height: 1.6; }
    .ok { color: var(--accent); }
    .secondary { height: 48px; border-radius: 14px; background: var(--fill); color: var(--ink); font-size: 15px; font-weight: 600; }
    .fine { margin: 0; font-size: 13px; color: var(--ink-2); text-align: center; }
    .error { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, #c0392b 10%, transparent); color: color-mix(in srgb, #b3261e 90%, var(--ink)); font-size: 14px; }
  `,
})
export class Account {
  protected readonly cloud = inject(CloudSync);
  protected readonly account = this.cloud.account;
  protected readonly open = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly signedIn = computed(() => !!this.account() && !this.account()!.anonymous);
  protected readonly initial = computed(() => (this.account()?.name ?? this.account()?.email ?? '؟').trim().charAt(0));

  protected async signIn() {
    this.error.set(null);
    const message = await this.cloud.signInWithGoogle();
    this.error.set(message);
    if (!message && this.signedIn()) setTimeout(() => this.open.set(false), 900);
  }

  protected async signOut() {
    this.error.set(null);
    await this.cloud.signOut();
    this.open.set(false);
  }
}
