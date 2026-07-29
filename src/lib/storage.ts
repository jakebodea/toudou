import { invoke } from "@tauri-apps/api/core";
import type { Capture } from "@/lib/types.ts";

interface StoredCapture {
  body: string;
  createdAt: number;
  done: boolean;
  doneAt: number | null;
  id: string;
  section: string;
  source: string;
  tags: string[];
}

function fromStored(row: StoredCapture): Capture {
  return {
    body: row.body,
    createdAt: row.createdAt,
    done: row.done,
    doneAt: row.doneAt,
    id: row.id,
    section: "inbox",
    source: row.source,
    tags: row.tags,
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function listCaptures(): Promise<Capture[]> {
  const rows = await invoke<StoredCapture[]>("list_captures");
  return rows.map(fromStored);
}

export async function createCapture(capture: Capture): Promise<Capture> {
  const row = await invoke<StoredCapture>("create_capture", {
    capture: {
      body: capture.body,
      createdAt: capture.createdAt,
      done: capture.done,
      doneAt: capture.doneAt,
      id: capture.id,
      section: "inbox",
      source: capture.source,
      tags: capture.tags,
    },
  });
  return fromStored(row);
}

export async function updateCaptureBody(
  id: string,
  body: string
): Promise<void> {
  await invoke("update_capture_body", { body, id });
}

export async function updateCaptureTags(
  id: string,
  tags: string[]
): Promise<void> {
  await invoke("update_capture_tags", { id, tags });
}

export async function setCaptureDone(
  id: string,
  done: boolean,
  doneAt: number | null
): Promise<void> {
  await invoke("set_capture_done", { done, doneAt, id });
}

export function purgeExpiredDone(cutoffMs: number): Promise<number> {
  return invoke<number>("purge_expired_done", { cutoffMs });
}

export function seedDemoCaptures(seed: Capture[]): Promise<boolean> {
  return invoke<boolean>("seed_demo_captures", {
    seed: seed.map((capture) => ({
      body: capture.body,
      createdAt: capture.createdAt,
      done: capture.done,
      doneAt: capture.doneAt,
      id: capture.id,
      section: "inbox",
      source: capture.source,
      tags: capture.tags,
    })),
  });
}
