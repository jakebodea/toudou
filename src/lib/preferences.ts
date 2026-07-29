import type { InboxSort, Theme } from "@/lib/types.ts";

const INBOX_SORT_KEY = "toudou.inboxSort";
const IN_PROGRESS_ENABLED_KEY = "toudou.inProgressEnabled";
const COPY_SETS_IN_PROGRESS_KEY = "toudou.copySetsInProgress";
const THEME_KEY = "toudou.theme";

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
  } catch {
    // ignore — private mode / unavailable storage
  }
  return fallback;
}

function writeBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // ignore
  }
}

export function readInboxSort(): InboxSort {
  try {
    const value = localStorage.getItem(INBOX_SORT_KEY);
    if (value === "newest" || value === "oldest") {
      return value;
    }
  } catch {
    // ignore — private mode / unavailable storage
  }
  return "oldest";
}

export function writeInboxSort(sort: InboxSort): void {
  try {
    localStorage.setItem(INBOX_SORT_KEY, sort);
  } catch {
    // ignore
  }
}

export function readInProgressEnabled(): boolean {
  return readBoolean(IN_PROGRESS_ENABLED_KEY, false);
}

export function writeInProgressEnabled(enabled: boolean): void {
  writeBoolean(IN_PROGRESS_ENABLED_KEY, enabled);
}

/** Only meaningful when in-progress workflow is enabled. Defaults on. */
export function readCopySetsInProgress(): boolean {
  return readBoolean(COPY_SETS_IN_PROGRESS_KEY, true);
}

export function writeCopySetsInProgress(enabled: boolean): void {
  writeBoolean(COPY_SETS_IN_PROGRESS_KEY, enabled);
}

/** Defaults to system when unset or invalid. */
export function readTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (value === "light" || value === "dark" || value === "system") {
      return value;
    }
  } catch {
    // ignore — private mode / unavailable storage
  }
  return "system";
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}
