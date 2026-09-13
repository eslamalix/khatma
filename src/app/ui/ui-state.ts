import { Injectable, signal } from '@angular/core';

/** Cross-screen UI state. */
@Injectable({ providedIn: 'root' })
export class UiState {
  /** Reading mode with all chrome hidden (P7). */
  readonly immersive = signal(false);
}
