import type { Capture } from "@/lib/types.ts";

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

export function activeCaptures(
  captures: readonly Capture[],
  query: string
): Capture[] {
  return filterCaptures(captures, query)
    .filter((capture) => !capture.done)
    .sort((a, b) => b.createdAt - a.createdAt);
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
