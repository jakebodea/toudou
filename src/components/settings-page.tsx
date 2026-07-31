import { emit } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { CaptureToast } from "@/components/capture-toast.tsx";
import { SettingsBody } from "@/components/settings-body.tsx";
import {
  PREFERENCE_CHANGE_EVENT,
  type PreferenceChange,
  readCopySetsInProgress,
  readInboxSort,
  readInProgressEnabled,
  readTheme,
  writeCopySetsInProgress,
  writeInboxSort,
  writeInProgressEnabled,
  writeTheme,
} from "@/lib/preferences.ts";
import { applyTheme, subscribeSystemTheme } from "@/lib/theme.ts";
import type { InboxSort, Theme } from "@/lib/types.ts";

const TOAST_MS = 1800;

export function SettingsPage() {
  const [inboxSort, setInboxSort] = useState<InboxSort>(() => readInboxSort());
  const [theme, setTheme] = useState<Theme>(() => readTheme());
  const [inProgressEnabled, setInProgressEnabled] = useState(() =>
    readInProgressEnabled()
  );
  const [copySetsInProgress, setCopySetsInProgress] = useState(() =>
    readCopySetsInProgress()
  );
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") {
      return;
    }
    return subscribeSystemTheme(() => {
      applyTheme("system");
    });
  }, [theme]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
    },
    []
  );

  function broadcast(change: PreferenceChange): void {
    void emit(PREFERENCE_CHANGE_EVENT, change);
  }

  function showToast(message: string): void {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => {
      setToastVisible(false);
      toastTimer.current = null;
    }, TOAST_MS);
  }

  function handleCopySetsInProgressChange(enabled: boolean): void {
    setCopySetsInProgress(enabled);
    writeCopySetsInProgress(enabled);
    broadcast({ key: "copySetsInProgress", value: enabled });
  }

  function handleInboxSortChange(sort: InboxSort): void {
    setInboxSort(sort);
    writeInboxSort(sort);
    broadcast({ key: "inboxSort", value: sort });
  }

  function handleInProgressEnabledChange(enabled: boolean): void {
    setInProgressEnabled(enabled);
    writeInProgressEnabled(enabled);
    broadcast({ key: "inProgressEnabled", value: enabled });
  }

  function handleThemeChange(next: Theme): void {
    setTheme(next);
    writeTheme(next);
    applyTheme(next);
    broadcast({ key: "theme", value: next });
  }

  return (
    <main className="relative flex h-svh flex-col overflow-hidden bg-muted/45">
      <div aria-hidden className="h-[28px] shrink-0" data-tauri-drag-region />
      <header className="shrink-0 px-5 pt-1 pb-4">
        <h1 className="font-heading font-medium text-lg">Settings</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Appearance, inbox order, and optional In Progress workflow.
        </p>
      </header>
      <div className="shrink-0 border-border/70 border-t" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsBody
          copySetsInProgress={copySetsInProgress}
          inboxSort={inboxSort}
          inProgressEnabled={inProgressEnabled}
          onCopySetsInProgressChange={handleCopySetsInProgressChange}
          onInboxSortChange={handleInboxSortChange}
          onInProgressEnabledChange={handleInProgressEnabledChange}
          onThemeChange={handleThemeChange}
          onToast={showToast}
          theme={theme}
        />
      </div>
      <CaptureToast message={toastMessage} visible={toastVisible} />
    </main>
  );
}
