import { captureImageSrc } from "@/lib/storage.ts";
import type { Capture } from "@/lib/types.ts";

/** True when key events should stay with the focused field (composer, search, TipTap, etc.). */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return (
    target.closest('[contenteditable="true"]') !== null ||
    target.closest('[role="textbox"]') !== null ||
    target.closest("[data-shortcut-ignore]") !== null
  );
}

/** Visible captures in list order for ↑/↓ navigation. */
export function navigableCaptures(
  active: Capture[],
  inProgress: Capture[],
  done: Capture[],
  doneOpen: boolean
): Capture[] {
  if (doneOpen) {
    return [...active, ...inProgress, ...done];
  }
  return [...active, ...inProgress];
}

export async function copyCaptureContent(capture: Capture): Promise<void> {
  if (capture.kind === "image" && capture.imagePath) {
    const src = captureImageSrc(capture);
    if (!src) {
      if (capture.body.length > 0) {
        await navigator.clipboard.writeText(capture.body);
      }
      return;
    }
    const response = await fetch(src);
    const blob = await response.blob();
    await navigator.clipboard.write([
      new ClipboardItem({ [blob.type || "image/png"]: blob }),
    ]);
    return;
  }
  if (capture.body.length === 0) {
    return;
  }
  await navigator.clipboard.writeText(capture.body);
}

export type InboxShortcutAction =
  | { type: "open-shortcuts" }
  | { type: "clear-selection" }
  | { type: "blur-target" }
  | { type: "clear-focus" }
  | { type: "focus-search" }
  | { type: "focus-composer" }
  | { type: "toggle-done" }
  | { type: "move-focus"; delta: number }
  | { type: "edit" }
  | { type: "primary" }
  | { type: "advance-status" }
  | { type: "delete" }
  | { type: "toggle-select" };

interface ResolveInboxShortcutInput {
  event: KeyboardEvent;
  focusedDone: boolean;
  hasFocus: boolean;
  hasSelection: boolean;
  modalOpen: boolean;
  typing: boolean;
}

function resolveEscapeAction(
  hasSelection: boolean,
  typing: boolean,
  hasFocus: boolean
): InboxShortcutAction | null {
  if (hasSelection) {
    return { type: "clear-selection" };
  }
  if (typing) {
    return { type: "blur-target" };
  }
  if (hasFocus) {
    return { type: "clear-focus" };
  }
  return null;
}

function resolveGlobalNavAction(
  key: string,
  meta: boolean,
  altKey: boolean
): InboxShortcutAction | null {
  if (key === "/" && !meta && !altKey) {
    return { type: "focus-search" };
  }
  if ((key === "f" || key === "F") && meta) {
    return { type: "focus-search" };
  }
  if (key === "n" && !meta && !altKey) {
    return { type: "focus-composer" };
  }
  if (key === "d" && !meta && !altKey) {
    return { type: "toggle-done" };
  }
  if (key === "ArrowDown") {
    return { delta: 1, type: "move-focus" };
  }
  if (key === "ArrowUp") {
    return { delta: -1, type: "move-focus" };
  }
  return null;
}

function resolveFocusedAction(
  key: string,
  meta: boolean,
  altKey: boolean,
  focusedDone: boolean
): InboxShortcutAction | null {
  if (key === "ArrowRight") {
    return focusedDone ? null : { type: "edit" };
  }
  if (key === "Enter" && !meta) {
    return { type: "primary" };
  }
  if (key === " " || key === "Spacebar") {
    return { type: "advance-status" };
  }
  if (key === "Backspace" || key === "Delete") {
    return { type: "delete" };
  }
  if (key === "x" && !meta && !altKey) {
    return { type: "toggle-select" };
  }
  return null;
}

/** Map a keydown to an inbox action, or null when the event should pass through. */
export function resolveInboxShortcut(
  input: ResolveInboxShortcutInput
): InboxShortcutAction | null {
  const { event, focusedDone, hasFocus, hasSelection, modalOpen, typing } =
    input;
  if (event.defaultPrevented || event.isComposing || modalOpen) {
    return null;
  }

  const { altKey, ctrlKey, key, metaKey, shiftKey } = event;
  const meta = metaKey || ctrlKey;

  if (!typing && (key === "?" || (shiftKey && key === "/"))) {
    return { type: "open-shortcuts" };
  }

  if (key === "Escape") {
    return resolveEscapeAction(hasSelection, typing, hasFocus);
  }

  if (typing) {
    return null;
  }

  const globalAction = resolveGlobalNavAction(key, meta, altKey);
  if (globalAction) {
    return globalAction;
  }

  if (!hasFocus) {
    return null;
  }

  return resolveFocusedAction(key, meta, altKey, focusedDone);
}
