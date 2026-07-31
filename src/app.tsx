import { getCurrentWindow } from "@tauri-apps/api/window";
import { CaptureShell } from "@/components/capture-shell.tsx";
import { SettingsPage } from "@/components/settings-page.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { isTauriRuntime } from "@/lib/storage.ts";

export default function App() {
  const isSettingsWindow =
    isTauriRuntime() && getCurrentWindow().label === "settings";

  return (
    <TooltipProvider delayDuration={400}>
      {isSettingsWindow ? <SettingsPage /> : <CaptureShell />}
    </TooltipProvider>
  );
}
