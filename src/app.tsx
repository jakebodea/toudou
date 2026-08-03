import { getCurrentWindow } from "@tauri-apps/api/window";
import { CaptureNoticeWindow } from "@/components/capture-notice.tsx";
import { CaptureShell } from "@/components/capture-shell.tsx";
import { SettingsPage } from "@/components/settings-page.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { isTauriRuntime } from "@/lib/storage.ts";

export default function App() {
  const currentWindowLabel = isTauriRuntime()
    ? getCurrentWindow().label
    : "main";

  if (currentWindowLabel === "capture-notice") {
    return <CaptureNoticeWindow />;
  }

  return (
    <TooltipProvider delayDuration={400}>
      {currentWindowLabel === "settings" ? <SettingsPage /> : <CaptureShell />}
    </TooltipProvider>
  );
}
