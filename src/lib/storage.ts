import { convertFileSrc } from "@tauri-apps/api/core";
import {
  commands,
  type NewCapture,
  type Result,
  type Capture as WireCapture,
} from "@/lib/bindings.ts";
import type { Capture, CaptureKind, CaptureStatus } from "@/lib/types.ts";

function unwrap<T>(result: Result<T, string>): T {
  if (result.status === "ok") {
    return result.data;
  }
  throw new Error(result.error);
}

function kindFromWire(kind: string): CaptureKind {
  return kind === "image" ? "image" : "text";
}

function fromWire(row: WireCapture): Capture {
  return {
    body: row.body,
    createdAt: row.createdAt,
    done: row.done,
    doneAt: row.doneAt,
    id: row.id,
    imagePath: row.imagePath,
    inProgress: row.inProgress,
    kind: kindFromWire(row.kind),
    section: "inbox",
    source: row.source,
    tags: row.tags,
  };
}

function toNewCapture(capture: Capture): NewCapture {
  return {
    body: capture.body,
    createdAt: capture.createdAt,
    done: capture.done,
    doneAt: capture.doneAt,
    id: capture.id,
    imagePath: capture.imagePath,
    inProgress: capture.inProgress,
    kind: capture.kind,
    section: "inbox",
    source: capture.source,
    tags: capture.tags,
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function captureImageSrc(capture: Capture): string | null {
  if (!capture.imagePath) {
    return null;
  }
  if (
    capture.imagePath.startsWith("data:") ||
    capture.imagePath.startsWith("blob:")
  ) {
    return capture.imagePath;
  }
  if (isTauriRuntime()) {
    return convertFileSrc(capture.imagePath);
  }
  return capture.imagePath;
}

export async function listCaptures(): Promise<Capture[]> {
  const rows = unwrap(await commands.listCaptures());
  return rows.map(fromWire);
}

export async function createCapture(capture: Capture): Promise<Capture> {
  const row = unwrap(await commands.createCapture(toNewCapture(capture)));
  return fromWire(row);
}

export async function createImageCapture(
  bytesBase64: string,
  mime: string,
  source = "towdow",
  body = ""
): Promise<Capture> {
  const row = unwrap(
    await commands.createImageCapture(bytesBase64, mime, source, body)
  );
  return fromWire(row);
}

export async function updateCaptureBody(
  id: string,
  body: string
): Promise<void> {
  unwrap(await commands.updateCaptureBody(id, body));
}

export async function updateCaptureTags(
  id: string,
  tags: string[]
): Promise<void> {
  unwrap(await commands.updateCaptureTags(id, tags));
}

export async function setCaptureDone(
  id: string,
  done: boolean,
  doneAt: number | null
): Promise<void> {
  unwrap(await commands.setCaptureDone(id, done, doneAt));
}

export async function setCaptureStatus(
  id: string,
  status: CaptureStatus
): Promise<void> {
  unwrap(await commands.setCaptureStatus(id, status));
}

export async function purgeExpiredDone(cutoffMs: number): Promise<number> {
  return unwrap(await commands.purgeExpiredDone(cutoffMs));
}

export async function deleteCapture(id: string): Promise<void> {
  unwrap(await commands.deleteCapture(id));
}

export async function clearAllCaptures(): Promise<number> {
  return unwrap(await commands.clearAllCaptures());
}

export async function seedDemoCaptures(seed: Capture[]): Promise<boolean> {
  return unwrap(await commands.seedDemoCaptures(seed.map(toNewCapture)));
}

export async function fileToBase64(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
