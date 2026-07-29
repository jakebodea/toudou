export type CaptureKind = "text" | "image";

export interface Capture {
  body: string;
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  id: string;
  /** Absolute path, data URL, or null. */
  imagePath: string | null;
  kind: CaptureKind;
  /** Kept for DB compat; UI is a single list. */
  section: "inbox";
  source: string;
  tags: string[];
}

/** Active inbox order by createdAt. */
export type InboxSort = "oldest" | "newest";
