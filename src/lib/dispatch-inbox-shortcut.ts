import type { InboxShortcutAction } from "@/lib/inbox-keyboard.ts";

export interface InboxShortcutHandlers {
  advanceStatus: () => void;
  blurTarget: (target: EventTarget | null) => void;
  clearFocus: () => void;
  clearSelection: () => void;
  deleteFocused: () => void;
  editFocused: () => void;
  focusComposer: () => void;
  focusSearch: () => void;
  moveFocus: (delta: number) => void;
  openShortcuts: () => void;
  runPrimary: () => void;
  toggleDone: () => void;
  toggleSelect: () => void;
}

export function dispatchInboxShortcut(
  action: InboxShortcutAction,
  target: EventTarget | null,
  handlers: InboxShortcutHandlers
): void {
  switch (action.type) {
    case "open-shortcuts":
      handlers.openShortcuts();
      return;
    case "clear-selection":
      handlers.clearSelection();
      return;
    case "blur-target":
      handlers.blurTarget(target);
      return;
    case "clear-focus":
      handlers.clearFocus();
      return;
    case "focus-search":
      handlers.focusSearch();
      return;
    case "focus-composer":
      handlers.focusComposer();
      return;
    case "toggle-done":
      handlers.toggleDone();
      return;
    case "move-focus":
      handlers.moveFocus(action.delta);
      return;
    case "edit":
      handlers.editFocused();
      return;
    case "primary":
      handlers.runPrimary();
      return;
    case "advance-status":
      handlers.advanceStatus();
      return;
    case "delete":
      handlers.deleteFocused();
      return;
    case "toggle-select":
      handlers.toggleSelect();
      return;
    default: {
      const _exhaustive: never = action;
      throw new Error(
        `Unhandled inbox shortcut: ${JSON.stringify(_exhaustive)}`
      );
    }
  }
}
