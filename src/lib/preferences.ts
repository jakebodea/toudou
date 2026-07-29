import type { InboxSort } from "@/lib/types.ts";

const INBOX_SORT_KEY = "towdow.inboxSort";

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
