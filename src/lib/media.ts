import type { CaptureKind } from "@/lib/types.ts";

export type MediaKind = Extract<CaptureKind, "image" | "video">;

export interface NativeMediaFile {
  kind: MediaKind;
  path: string;
}

export type ComposerMedia = File | NativeMediaFile;

const MEDIA_BY_EXTENSION: Record<string, MediaKind> = {
  avi: "video",
  avif: "image",
  gif: "image",
  heic: "image",
  heif: "image",
  jpeg: "image",
  jpg: "image",
  m4v: "video",
  mov: "video",
  mp4: "video",
  ogv: "video",
  png: "image",
  webm: "video",
  webp: "image",
};

function extensionForPath(path: string): string {
  const extension = path.split(".").pop();
  return extension?.toLowerCase() ?? "";
}

export function isNativeMedia(media: ComposerMedia): media is NativeMediaFile {
  return "path" in media;
}

export function mediaFromPath(path: string): NativeMediaFile | null {
  const kind = MEDIA_BY_EXTENSION[extensionForPath(path)];
  return kind ? { kind, path } : null;
}

export function mediaKindFromFile(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return mediaFromPath(file.name)?.kind ?? null;
}
