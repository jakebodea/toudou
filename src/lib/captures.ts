import type { Capture, Section } from "@/lib/types.ts";

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

export function activeBySection(
  captures: readonly Capture[],
  section: Section,
  query: string
): Capture[] {
  return filterCaptures(captures, query)
    .filter((capture) => !capture.done && capture.section === section)
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
