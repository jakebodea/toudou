import { useCallback, useEffect, useState } from "react";
import { commands, type PermissionStatus } from "@/lib/bindings.ts";
import { isTauriRuntime } from "@/lib/storage.ts";

interface CapturePermissionStatus {
  refresh: () => Promise<void>;
  status: PermissionStatus | null;
}

export function useCapturePermissionStatus(): CapturePermissionStatus {
  const [status, setStatus] = useState<PermissionStatus | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!isTauriRuntime()) {
      return;
    }

    try {
      setStatus(await commands.capturePermissionStatus());
    } catch {
      // The app remains usable when the native permission API is unavailable.
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return { refresh, status };
}
