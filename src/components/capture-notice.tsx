import { listen } from "@tauri-apps/api/event";
import type { Window } from "@tauri-apps/api/window";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { useEffect, useRef, useState } from "react";
import { CaptureToast } from "@/components/capture-toast.tsx";
import type { CaptureNotice } from "@/lib/bindings.ts";
import { getCaptureNoticeMessage } from "@/lib/capture-notice.ts";

const CAPTURE_NOTICE_EVENT = "capture://created";
const CAPTURE_NOTICE_MS = 1800;

async function hideCaptureNotice(window: Window): Promise<void> {
  try {
    await window.hide();
  } catch {
    // The window may already be closed during app shutdown.
  }
}

async function showCaptureNotice(window: Window): Promise<void> {
  try {
    await window.show();
  } catch {
    // The window may still be initializing during app startup.
  }
}

async function requestNotificationPermission(): Promise<void> {
  try {
    if (await isPermissionGranted()) {
      return;
    }

    await requestPermission();
  } catch {
    // The in-app overlay does not depend on Notification Center permissions.
  }
}

export function CaptureNoticeWindow() {
  const [message, setMessage] = useState("Added to toudou");
  const [visible, setVisible] = useState(false);
  const noticeTimer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("capture-notice-html");
    document.body.classList.add("capture-notice-body");

    const currentWindow = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void requestNotificationPermission();

    listen<CaptureNotice>(CAPTURE_NOTICE_EVENT, ({ payload }) => {
      if (disposed) {
        return;
      }

      setMessage(getCaptureNoticeMessage(payload.source));
      setVisible(true);
      void showCaptureNotice(currentWindow);

      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
      }

      noticeTimer.current = window.setTimeout(() => {
        setVisible(false);
        noticeTimer.current = null;
        void hideCaptureNotice(currentWindow);
      }, CAPTURE_NOTICE_MS);
    })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
          return;
        }

        unlisten = stopListening;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();

      if (noticeTimer.current !== null) {
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = null;
      }

      document.documentElement.classList.remove("capture-notice-html");
      document.body.classList.remove("capture-notice-body");
    };
  }, []);

  return (
    <div className="h-full w-full">
      <CaptureToast message={message} placement="overlay" visible={visible} />
    </div>
  );
}
