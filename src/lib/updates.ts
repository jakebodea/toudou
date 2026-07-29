import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { isTauriRuntime } from "@/lib/storage.ts";

export type UpdateCheckResult =
  | { status: "unavailable" }
  | { status: "up-to-date" }
  | { status: "updated"; version: string }
  | { status: "error"; message: string };

export function updateResultMessage(result: UpdateCheckResult): string {
  if (result.status === "up-to-date") {
    return "You're up to date";
  }
  if (result.status === "updated") {
    return `Updating to ${result.version}…`;
  }
  if (result.status === "unavailable") {
    return "Updates only in the desktop app";
  }
  return "Couldn't check for updates";
}

/**
 * Check GitHub Releases for a newer build, install it, and relaunch.
 * No-ops outside Tauri (Vite browser preview).
 */
export async function checkAndInstallUpdate(): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { status: "unavailable" };
  }

  try {
    const update = await check();
    if (!update) {
      return { status: "up-to-date" };
    }

    const { version } = update;
    await update.downloadAndInstall();
    // Fire-and-forget so callers can toast before the process exits.
    void relaunch();
    return { status: "updated", version };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { message, status: "error" };
  }
}
