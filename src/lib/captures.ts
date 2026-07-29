import type { Capture, InboxSort } from "@/lib/types.ts";

const TAG_SPLIT = /[,\s]+/;
const LEADING_HASH = /^#/;

export function filterCaptures(
  captures: readonly Capture[],
  query: string
): Capture[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [...captures];
  }
  return captures.filter((capture) => {
    const haystack = `${capture.body} ${capture.source} ${capture.tags.join(" ")}`;
    return haystack.toLowerCase().includes(q);
  });
}

function sortByCreatedAt(captures: Capture[], sort: InboxSort): Capture[] {
  return captures.sort((a, b) =>
    sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt
  );
}

/** Inbox items that are not Done (and not In Progress when that stage is on). */
export function activeCaptures(
  captures: readonly Capture[],
  query: string,
  sort: InboxSort = "oldest",
  inProgressEnabled = false
): Capture[] {
  return sortByCreatedAt(
    filterCaptures(captures, query).filter((capture) => {
      if (capture.done) {
        return false;
      }
      if (inProgressEnabled && capture.inProgress) {
        return false;
      }
      return true;
    }),
    sort
  );
}

export function inProgressCaptures(
  captures: readonly Capture[],
  query: string,
  sort: InboxSort = "oldest"
): Capture[] {
  return sortByCreatedAt(
    filterCaptures(captures, query).filter(
      (capture) => capture.inProgress && !capture.done
    ),
    sort
  );
}

export function doneCaptures(
  captures: readonly Capture[],
  query: string
): Capture[] {
  return filterCaptures(captures, query)
    .filter((capture) => capture.done)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}

export function numberedList(bodies: readonly string[]): string {
  return bodies.map((body, index) => `${index + 1}. ${body.trim()}`).join("\n");
}

/** Line for multi-copy; images become a placeholder. */
export function captureListLine(capture: {
  body: string;
  kind: string;
}): string {
  if (capture.kind === "image") {
    return "[Image]";
  }
  return capture.body.trim();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of input.split(TAG_SPLIT)) {
    const tag = part.trim().toLowerCase().replace(LEADING_HASH, "");
    if (tag.length === 0 || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}
