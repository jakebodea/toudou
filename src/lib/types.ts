export type CaptureKind = "text" | "image";

/** Workflow stage for a Capture. */
export type CaptureStatus = "active" | "in_progress" | "done";

export interface Capture {
  body: string;
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  id: string;
  /** Absolute path, data URL, or null. */
  imagePath: string | null;
  /** Middle stage between inbox and Done; mutually exclusive with done. */
  inProgress: boolean;
  kind: CaptureKind;
  /** Kept for DB compat; UI is a single list. */
  section: "inbox";
  source: string;
  tags: string[];
}

/** Active inbox order by createdAt. */
export type InboxSort = "oldest" | "newest";

export function captureStatus(capture: Capture): CaptureStatus {
  if (capture.done) {
    return "done";
  }
  if (capture.inProgress) {
    return "in_progress";
  }
  return "active";
}

export function statusFields(status: CaptureStatus): {
  done: boolean;
  doneAt: number | null;
  inProgress: boolean;
} {
  switch (status) {
    case "done":
      return { done: true, doneAt: Date.now(), inProgress: false };
    case "in_progress":
      return { done: false, doneAt: null, inProgress: true };
    case "active":
      return { done: false, doneAt: null, inProgress: false };
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled capture status: ${_exhaustive}`);
    }
  }
}
