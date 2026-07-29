import { listen } from "@tauri-apps/api/event";
import {
  MoreHorizontalIcon,
  SearchIcon,
  TextSelectIcon,
  Trash2Icon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureCard } from "@/components/capture-card.tsx";
import { CaptureComposer } from "@/components/capture-composer.tsx";
import { CaptureInboxList } from "@/components/capture-inbox-list.tsx";
import { CapturePermissions } from "@/components/capture-permissions.tsx";
import { CaptureSettings } from "@/components/capture-settings.tsx";
import { CaptureToast } from "@/components/capture-toast.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Kbd, KbdGroup } from "@/components/ui/kbd.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { commands } from "@/lib/bindings.ts";
import {
  activeCaptures,
  captureListLine,
  collectUsedTags,
  doneCaptures,
  inProgressCaptures,
  newId,
  numberedList,
} from "@/lib/captures.ts";
import {
  clearAllAnimationMs,
  LIST_EXIT_TRANSITION,
  LIST_LAYOUT_TRANSITION,
} from "@/lib/list-motion.ts";
import {
  readCopySetsInProgress,
  readInboxSort,
  readInProgressEnabled,
  writeCopySetsInProgress,
  writeInboxSort,
  writeInProgressEnabled,
} from "@/lib/preferences.ts";
import { seedCaptures } from "@/lib/seed.ts";
import {
  clearAllCaptures,
  createImageCapture,
  fileToBase64,
  isTauriRuntime,
  listCaptures,
  createCapture as persistCreate,
  purgeExpiredDone,
  seedDemoCaptures,
  setCaptureStatus,
  updateCaptureBody,
  updateCaptureTags,
} from "@/lib/storage.ts";
import {
  type Capture,
  type CaptureStatus,
  captureStatus,
  type InboxSort,
  statusFields,
} from "@/lib/types.ts";

const TOAST_MS = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Let the checkmark paint before the card leaves the inbox. */
const CHECK_ACK_MS = 220;

export function CaptureShell() {
  const reduceMotion = useReducedMotion();
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("Captured");
  const [doneOpen, setDoneOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [inboxSort, setInboxSort] = useState<InboxSort>(() => readInboxSort());
  const [inProgressEnabled, setInProgressEnabled] = useState(() =>
    readInProgressEnabled()
  );
  const [copySetsInProgress, setCopySetsInProgress] = useState(() =>
    readCopySetsInProgress()
  );
  const [checkingIds, setCheckingIds] = useState<Set<string>>(() => new Set());
  const [footerPad, setFooterPad] = useState(96);
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null);
  const toastTimer = useRef<number | null>(null);
  const clearAllTimer = useRef<number | null>(null);
  const layoutEnabled = !reduceMotion;
  const sharedLayout = Boolean(
    layoutEnabled && (doneOpen || inProgressEnabled)
  );

  const active = useMemo(
    () => activeCaptures(captures, query, inboxSort, inProgressEnabled),
    [captures, query, inboxSort, inProgressEnabled]
  );
  const inProgress = useMemo(
    () =>
      inProgressEnabled ? inProgressCaptures(captures, query, inboxSort) : [],
    [captures, query, inboxSort, inProgressEnabled]
  );
  const done = useMemo(() => doneCaptures(captures, query), [captures, query]);
  const knownTags = useMemo(() => collectUsedTags(captures), [captures]);
  const isVacant = captures.length === 0;
  const noMatches =
    captures.length > 0 &&
    active.length === 0 &&
    inProgress.length === 0 &&
    done.length === 0;

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!isTauriRuntime()) {
        if (!cancelled) {
          setCaptures(seedCaptures());
          setReady(true);
        }
        return;
      }

      await seedDemoCaptures(seedCaptures());
      const rows = await listCaptures();
      if (!cancelled) {
        setCaptures(rows);
        setReady(true);
      }
    };

    boot().catch(() => {
      if (!cancelled) {
        setCaptures(seedCaptures());
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!(ready && isTauriRuntime())) {
      return;
    }

    let cancelled = false;
    const unlisten = listen<{ id: string; body: string; source: string }>(
      "capture://created",
      () => {
        listCaptures()
          .then((rows) => {
            if (cancelled) {
              return;
            }
            setCaptures(rows);
            setToastVisible(true);
            if (toastTimer.current !== null) {
              window.clearTimeout(toastTimer.current);
            }
            toastTimer.current = window.setTimeout(() => {
              setToastVisible(false);
              toastTimer.current = null;
            }, TOAST_MS);
          })
          .catch(() => undefined);
      }
    );

    return () => {
      cancelled = true;
      unlisten
        .then((fn) => {
          fn();
        })
        .catch(() => undefined);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const purge = () => {
      const cutoff = Date.now() - DAY_MS;
      if (isTauriRuntime()) {
        purgeExpiredDone(cutoff)
          .then(() => listCaptures())
          .then(setCaptures)
          .catch(() => undefined);
        return;
      }
      setCaptures((prev) =>
        prev.filter(
          (capture) =>
            !(
              capture.done &&
              capture.doneAt !== null &&
              capture.doneAt <= cutoff
            )
        )
      );
    };

    purge();
    const id = window.setInterval(purge, 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, [ready]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) {
        window.clearTimeout(toastTimer.current);
      }
      if (clearAllTimer.current !== null) {
        window.clearTimeout(clearAllTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!footerEl) {
      return;
    }
    const syncPad = () => {
      setFooterPad(Math.ceil(footerEl.getBoundingClientRect().height));
    };
    syncPad();
    const observer = new ResizeObserver(syncPad);
    observer.observe(footerEl);
    return () => {
      observer.disconnect();
    };
  }, [footerEl]);

  const showToast = (message = "Captured") => {
    setToastMessage(message);
    setToastVisible(true);
    if (toastTimer.current !== null) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => {
      setToastVisible(false);
      toastTimer.current = null;
    }, TOAST_MS);
  };

  const addCapture = (body: string, source = "towdow", tags: string[] = []) => {
    const capture: Capture = {
      body,
      createdAt: Date.now(),
      done: false,
      doneAt: null,
      id: newId(),
      imagePath: null,
      inProgress: false,
      kind: "text",
      section: "inbox",
      source,
      tags,
    };

    if (isTauriRuntime()) {
      persistCreate(capture)
        .then((saved) => {
          setCaptures((prev) => [saved, ...prev]);
          showToast();
        })
        .catch(() => undefined);
      return;
    }

    setCaptures((prev) => [capture, ...prev]);
    showToast();
  };

  const addImageCapture = (file: File, body = "", tags: string[] = []) => {
    if (isTauriRuntime()) {
      fileToBase64(file)
        .then((bytesBase64) =>
          createImageCapture(
            bytesBase64,
            file.type || "image/png",
            "towdow",
            body
          )
        )
        .then(async (saved) => {
          if (tags.length === 0) {
            return saved;
          }
          await updateCaptureTags(saved.id, tags);
          return { ...saved, tags };
        })
        .then((saved) => {
          setCaptures((prev) => [saved, ...prev]);
          showToast("Captured");
        })
        .catch(() => undefined);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : null;
      if (!dataUrl) {
        return;
      }
      const capture: Capture = {
        body,
        createdAt: Date.now(),
        done: false,
        doneAt: null,
        id: newId(),
        imagePath: dataUrl,
        inProgress: false,
        kind: "image",
        section: "inbox",
        source: "towdow",
        tags,
      };
      setCaptures((prev) => [capture, ...prev]);
      showToast("Captured");
    };
    reader.readAsDataURL(file);
  };

  const submitComposer = (body: string, image: File | null, tags: string[]) => {
    if (image) {
      addImageCapture(image, body, tags);
      return;
    }
    addCapture(body, "towdow", tags);
  };

  const runCaptureNow = () => {
    if (isTauriRuntime()) {
      commands.captureNow().catch(() => {
        addCapture("Simulated global capture — selection only.", "Safari");
      });
      return;
    }
    addCapture("Simulated global capture — selection only.", "Safari");
  };

  const applyStatus = (id: string, status: CaptureStatus) => {
    const fields = statusFields(status);
    setCaptures((prev) =>
      prev.map((capture) =>
        capture.id === id ? { ...capture, ...fields } : capture
      )
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const setStatus = (id: string, status: CaptureStatus) => {
    const current = captures.find((capture) => capture.id === id);
    if (!current || checkingIds.has(id)) {
      return;
    }
    if (captureStatus(current) === status) {
      return;
    }

    const persist = () => {
      if (isTauriRuntime()) {
        setCaptureStatus(id, status)
          .then(() => {
            applyStatus(id, status);
          })
          .catch(() => undefined);
        return;
      }
      applyStatus(id, status);
    };

    // Completing: show the check briefly, then move. Other transitions are immediate.
    if (status === "done") {
      setCheckingIds((prev) => new Set(prev).add(id));
      window.setTimeout(() => {
        persist();
        setCheckingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, CHECK_ACK_MS);
      return;
    }
    persist();
  };

  const handleCopied = (id: string) => {
    showToast("Copied");
    if (!(inProgressEnabled && copySetsInProgress)) {
      return;
    }
    const current = captures.find((capture) => capture.id === id);
    if (!current || current.done || current.inProgress) {
      return;
    }
    setStatus(id, "in_progress");
  };

  const clearAll = () => {
    if (clearingAll || captures.length === 0) {
      return;
    }

    const startedAt = performance.now();
    const visibleCount =
      active.length + inProgress.length + (doneOpen ? done.length : 0);
    const animMs = reduceMotion ? 0 : clearAllAnimationMs(visibleCount);

    const apply = () => {
      const remaining = Math.max(0, animMs - (performance.now() - startedAt));
      if (clearAllTimer.current !== null) {
        window.clearTimeout(clearAllTimer.current);
      }
      clearAllTimer.current = window.setTimeout(() => {
        clearAllTimer.current = null;
        setCaptures([]);
        setSelectedIds(new Set());
        setCheckingIds(new Set());
        setClearingAll(false);
        showToast("Cleared");
      }, remaining);
    };

    setClearingAll(true);
    setClearAllOpen(false);
    if (isTauriRuntime()) {
      clearAllCaptures()
        .then(apply)
        .catch(() => {
          setClearingAll(false);
        });
      return;
    }
    apply();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const saveCapture = (id: string, body: string, tags: string[]) => {
    const current = captures.find((capture) => capture.id === id);
    if (!current) {
      return;
    }
    const trimmed = body.trim();
    if (trimmed.length === 0 && current.kind !== "image") {
      return;
    }

    const apply = () => {
      setCaptures((prev) =>
        prev.map((capture) =>
          capture.id === id ? { ...capture, body: trimmed, tags } : capture
        )
      );
    };

    if (isTauriRuntime()) {
      Promise.all([updateCaptureBody(id, trimmed), updateCaptureTags(id, tags)])
        .then(apply)
        .catch(() => undefined);
      return;
    }
    apply();
  };

  const filterByTag = (tag: string) => {
    setQuery(`#${tag}`);
  };

  const copySelected = async () => {
    const lines = [...active, ...inProgress]
      .filter((capture) => selectedIds.has(capture.id))
      .map((capture) => captureListLine(capture));
    if (lines.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(numberedList(lines));
    setSelectedIds(new Set());
  };

  const setSort = (sort: InboxSort) => {
    setInboxSort(sort);
    writeInboxSort(sort);
  };

  if (!ready) {
    return (
      <div className="flex h-svh flex-col overflow-hidden overscroll-none bg-muted/45 text-muted-foreground text-sm">
        <div aria-hidden className="h-[28px] shrink-0" data-tauri-drag-region />
        <div className="flex flex-1 items-center justify-center">Loading…</div>
      </div>
    );
  }

  const renderCard = (capture: Capture) => (
    <CaptureCard
      capture={capture}
      checking={checkingIds.has(capture.id)}
      inProgressEnabled={inProgressEnabled}
      onCopied={() => {
        handleCopied(capture.id);
      }}
      onFilterTag={filterByTag}
      onSave={saveCapture}
      onSetStatus={setStatus}
      onToggleSelect={toggleSelect}
      selected={selectedIds.has(capture.id)}
    />
  );

  return (
    <div className="relative flex h-svh flex-col overflow-hidden overscroll-none bg-muted/45">
      <div aria-hidden className="h-[28px] shrink-0" data-tauri-drag-region />
      <CaptureToast message={toastMessage} visible={toastVisible} />

      <header className="flex shrink-0 items-center gap-2 overscroll-none px-4 pt-2 pb-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            aria-label="Search"
            className="h-10 rounded-full border-0 bg-background/90 pr-3 pl-9 shadow-sm ring-1 ring-black/5 transition-[box-shadow] duration-150 focus-visible:shadow-md focus-visible:ring-foreground/10"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="Search or tag"
            value={query}
          />
        </div>
        <CaptureSettings
          copySetsInProgress={copySetsInProgress}
          inboxSort={inboxSort}
          inProgressEnabled={inProgressEnabled}
          onCopySetsInProgressChange={(enabled) => {
            setCopySetsInProgress(enabled);
            writeCopySetsInProgress(enabled);
          }}
          onInboxSortChange={setSort}
          onInProgressEnabledChange={(enabled) => {
            setInProgressEnabled(enabled);
            writeInProgressEnabled(enabled);
          }}
          onOpenChange={setSettingsOpen}
          open={settingsOpen}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Capture menu"
              className="size-10 shrink-0 rounded-full hover:bg-foreground/10 active:scale-[0.96] aria-expanded:bg-foreground/10"
              size="icon"
              title="Capture menu"
              type="button"
              variant="ghost"
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Capture</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                runCaptureNow();
              }}
            >
              <TextSelectIcon />
              Capture selection
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isVacant}
              onClick={() => {
                setClearAllOpen(true);
              }}
              variant="destructive"
            >
              <Trash2Icon />
              Clear all
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal text-muted-foreground text-xs">
              <span className="flex items-center gap-1.5">
                Global
                <KbdGroup>
                  <Kbd>⇧</Kbd>
                  <Kbd>⇧</Kbd>
                </KbdGroup>
                or
                <KbdGroup>
                  <Kbd>⌘</Kbd>
                  <Kbd>⇧</Kbd>
                  <Kbd>Space</Kbd>
                </KbdGroup>
              </span>
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog
          onOpenChange={(open) => {
            if (clearingAll) {
              return;
            }
            setClearAllOpen(open);
          }}
          open={clearAllOpen}
        >
          <DialogContent className="sm:max-w-sm" showCloseButton>
            <DialogHeader>
              <DialogTitle>Clear all captures?</DialogTitle>
              <DialogDescription>
                Permanently deletes every capture and attached image. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button disabled={clearingAll} type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                disabled={clearingAll || isVacant}
                onClick={clearAll}
                type="button"
                variant="destructive"
              >
                {clearingAll ? "Clearing…" : "Clear all"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {/* Bottom pad tracks floating footer height so the last cards clear the composer. */}
        <div style={{ paddingBottom: footerPad }}>
          <CaptureInboxList
            active={active}
            clearingAll={clearingAll}
            done={done}
            doneOpen={doneOpen}
            inProgress={inProgress}
            inProgressEnabled={inProgressEnabled}
            isVacant={isVacant}
            layoutEnabled={layoutEnabled}
            listExitTransition={LIST_EXIT_TRANSITION}
            listLayoutTransition={LIST_LAYOUT_TRANSITION}
            noMatches={noMatches}
            onDoneOpenChange={setDoneOpen}
            query={query}
            reduceMotion={reduceMotion}
            renderCard={renderCard}
            sharedLayout={sharedLayout}
          />
        </div>
      </ScrollArea>

      <footer
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 overscroll-none bg-transparent pt-1 pb-4"
        ref={setFooterEl}
      >
        <div className="pointer-events-auto">
          <CapturePermissions />
        </div>
        {selectedIds.size > 0 ? (
          <div className="fade-in slide-in-from-bottom-1 pointer-events-auto mx-4 flex animate-in items-center justify-between rounded-2xl bg-foreground px-3.5 py-2.5 text-background text-sm duration-150">
            <span className="flex items-center gap-2">
              {selectedIds.size} selected
              <span className="hidden text-background/60 text-xs sm:inline">
                ⌘-click to toggle
              </span>
            </span>
            <Button
              className="h-8 rounded-full bg-background text-foreground hover:bg-background/90 active:scale-[0.97]"
              onClick={() => {
                copySelected().catch(() => undefined);
              }}
              size="sm"
              type="button"
            >
              Copy as list
            </Button>
          </div>
        ) : null}
        <div className="pointer-events-auto px-4">
          <CaptureComposer
            knownTags={knownTags}
            onSubmit={({ body, image, tags }) => {
              submitComposer(body, image, tags);
            }}
          />
        </div>
      </footer>
    </div>
  );
}
