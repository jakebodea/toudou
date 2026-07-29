export type Section = "prompts" | "links" | "inbox";

export interface Capture {
  body: string;
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  id: string;
  section: Section;
  source: string;
  tags: string[];
}

export const SECTION_LABEL: Record<Section, string> = {
  inbox: "INBOX",
  links: "LINKS",
  prompts: "PROMPTS",
};
