import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isTauriRuntime } from "@/lib/storage.ts";

export const SETTINGS_WINDOW_LABEL = "settings";

export async function openSettingsWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  const settingsWindow = await WebviewWindow.getByLabel(SETTINGS_WINDOW_LABEL);
  if (!settingsWindow) {
    return;
  }

  await settingsWindow.unminimize();
  await settingsWindow.show();
  await settingsWindow.setFocus();
}
