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
}

export interface ReadingState {
  currentKhatma: number;
  lastPage: number;
  lastReadAt: number | null;
  /** Quran text scale, 1 = default. */
  fontScale: number;
}

export const DEFAULT_STATE: ReadingState = { currentKhatma: 1, lastPage: 1, lastReadAt: null, fontScale: 1 };
