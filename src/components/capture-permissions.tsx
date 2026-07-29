import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { isTauriRuntime } from "@/lib/storage.ts";

interface PermissionStatus {
  accessibility: boolean;
  inputMonitoring: boolean;
}

export function CapturePermissions() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    invoke<PermissionStatus>("capture_permission_status")
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
        {status.accessibility ? " ✓" : ""} for selection.{" "}
        <span className="text-foreground">⌘⇧Space</span> still works with
        clipboard fallback.
      </p>
      <Button
        className="mt-2 h-8 rounded-full"
        onClick={() => {
          invoke<PermissionStatus>("request_capture_permissions")
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
