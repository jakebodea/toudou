import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { commands, type PermissionStatus } from "@/lib/bindings.ts";
import { isTauriRuntime } from "@/lib/storage.ts";

export function CapturePermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    commands
      .capturePermissionStatus()
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  if (!status) {
    return null;
  }

  const needsHelp = !(status.accessibility && status.inputMonitoring);
  if (!needsHelp) {
    return null;
  }

  return (
    <div className="mx-4 mb-2 rounded-2xl bg-background px-3.5 py-3 text-muted-foreground text-sm shadow-sm ring-1 ring-black/5">
      <p className="leading-snug">
        Double-Shift needs Input Monitoring
        {status.inputMonitoring ? " ✓" : ""} and Accessibility
        {status.accessibility ? " ✓" : ""} to read the selection. Nothing is
        captured unless text is highlighted.{" "}
        <span className="text-foreground">⌘⇧Space</span> uses the same
        selection-only path.
      </p>
      <Button
        className="mt-2 h-8 rounded-full"
        onClick={() => {
          commands
            .requestCapturePermissions()
            .then(setStatus)
            .catch(() => undefined);
        }}
        size="sm"
        type="button"
        variant="secondary"
      >
        Request permissions
      </Button>
    </div>
  );
}
