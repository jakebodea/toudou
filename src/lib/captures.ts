import type { Capture, InboxSort } from "@/lib/types.ts";

const TAG_SPLIT = /[,\s]+/;
const LEADING_HASH = /^#/;
const HASH_TAG_TOKEN = /(^|\s)#([^\s#]+)/g;
const ACTIVE_HASH_QUERY = /(?:^|\s)#([^\s#]*)$/;
const MULTI_SPACE = /\s+/g;

export function filterCaptures(
  captures: readonly Capture[],
  query: string
): Capture[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [...captures];
  }
  if (q.startsWith("#")) {
    const tagQuery = q.slice(1);
    if (tagQuery.length === 0) {
      return [...captures];
    }
    return captures.filter((capture) =>
      capture.tags.some((tag) => tag === tagQuery || tag.startsWith(tagQuery))
    );
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

/** Line for multi-copy; image-only captures become a placeholder. */
export function captureListLine(capture: {
  body: string;
  kind: string;
}): string {
  const body = capture.body.trim();
  if (body.length > 0) {
    return body;
  }
  if (capture.kind === "image") {
    return "[Image]";
  }
  return body;
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

/** Distinct tags across captures, most-used first then alphabetical. */
export function collectUsedTags(captures: readonly Capture[]): string[] {
  const counts = new Map<string, number>();
  for (const capture of captures) {
    for (const tag of capture.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}

export interface ComposerTagParse {
  body: string;
  tags: string[];
}

/** Pull `#tag` tokens out of composer text into Capture.tags. */
export function extractComposerTags(input: string): ComposerTagParse {
  const seen = new Set<string>();
  const tags: string[] = [];
  HASH_TAG_TOKEN.lastIndex = 0;
  const body = input
    .replace(HASH_TAG_TOKEN, (match, lead: string, raw: string) => {
      const tag = raw.trim().toLowerCase().replace(LEADING_HASH, "");
      if (tag.length === 0) {
        return match;
      }
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
      return lead;
    })
    .replace(MULTI_SPACE, " ")
    .trim();
  return { body, tags };
}

/** Active `#query` immediately before the caret, if any. */
export function activeHashQuery(
  value: string,
  caret: number
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const match = ACTIVE_HASH_QUERY.exec(before);
  if (!match) {
    return null;
  }
  const query = match[1] ?? "";
  const start = before.length - query.length - 1;
  return { query, start };
}

export function filterTagSuggestions(
  knownTags: readonly string[],
  query: string,
  limit = 8
): string[] {
  const q = query.trim().toLowerCase();
  const filtered =
    q.length === 0
      ? [...knownTags]
      : knownTags.filter((tag) => tag.includes(q));
  return filtered.slice(0, limit);
}
