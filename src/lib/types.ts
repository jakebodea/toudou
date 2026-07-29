export interface Capture {
  body: string;
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  id: string;
  /** Kept for DB compat; UI is a single list. */
  section: "inbox";
  source: string;
  tags: string[];
}
