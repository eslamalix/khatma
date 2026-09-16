/** One counted visit to a mushaf page. */
export interface Reading {
  id: string;
  page: number;
  khatma: number;
  /** Epoch ms when counting started on this page. */
  startAt: number;
  /** Epoch ms of the last counted instant. */
  endAt: number;
  /** Active reading time (pauses and idle time excluded). */
  durationMs: number;
  /** 1 once written to the cloud. */
  synced: 0 | 1;
  /**
   * The account uid this reading was written to. Anything else — no account yet, or the reading was
   * recorded while signed out — means it still has to go up, so a change of account never loses it.
   */
  syncedTo?: string;
}

/**
 * The readings an account has never received: never uploaded, or uploaded to a different account
 * (recorded while signed out, or before this device was linked to this account).
 */
export function pendingFor(readings: readonly Reading[], uid: string) {
  return readings.filter((r) => r.syncedTo !== uid);
}

export type BackgroundTheme = 'auto' | 'cream' | 'white' | 'dark';
export type ReadingMode = 'horizontal' | 'vertical';

export interface ReadingState {
  currentKhatma: number;
  lastPage: number;
  lastReadAt: number | null;
  /** Quran text scale, 1 = default. */
  fontScale: number;
  backgroundTheme: BackgroundTheme;
  readingMode: ReadingMode;
  /** Daily wird in pages; null until the reader chooses one. */
  dailyGoalPages: number | null;
}

export const DEFAULT_STATE: ReadingState = {
  currentKhatma: 1,
  lastPage: 1,
  lastReadAt: null,
  fontScale: 1,
  backgroundTheme: 'auto',
  readingMode: 'horizontal',
  dailyGoalPages: null,
};
