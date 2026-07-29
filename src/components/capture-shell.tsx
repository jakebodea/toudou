import { listen } from "@tauri-apps/api/event";
import { ClipboardIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureCard } from "@/components/capture-card.tsx";
import { CaptureComposer } from "@/components/capture-composer.tsx";
import { CapturePermissions } from "@/components/capture-permissions.tsx";
import { CaptureToast } from "@/components/capture-toast.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  doneCaptures,
  newId,
  numberedList,
} from "@/lib/captures.ts";
import {
  LIST_EXIT_TRANSITION,
  LIST_LAYOUT_TRANSITION,
} from "@/lib/list-motion.ts";
import { readInboxSort, writeInboxSort } from "@/lib/preferences.ts";
import { seedCaptures } from "@/lib/seed.ts";
import {
  createImageCapture,
  fileToBase64,
  isTauriRuntime,
  listCaptures,
  createCapture as persistCreate,
  purgeExpiredDone,
  seedDemoCaptures,
  setCaptureDone,
  updateCaptureBody,
  updateCaptureTags,
} from "@/lib/storage.ts";
import type { Capture, InboxSort } from "@/lib/types.ts";

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
  const [inboxSort, setInboxSort] = useState<InboxSort>(() => readInboxSort());
  const [checkingIds, setCheckingIds] = useState<Set<string>>(() => new Set());
  const toastTimer = useRef<number | null>(null);
  const layoutEnabled = !reduceMotion;
  const sharedLayout = Boolean(doneOpen && layoutEnabled);

  const active = useMemo(
    () => activeCaptures(captures, query, inboxSort),
    [captures, query, inboxSort]
  );
  const done = useMemo(() => doneCaptures(captures, query), [captures, query]);
  const isVacant = captures.length === 0;
  const noMatches =
    captures.length > 0 && active.length === 0 && done.length === 0;

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
    },
    []
  );

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

  const addCapture = (body: string, source = "Towdow") => {
    const capture: Capture = {
      body,
      createdAt: Date.now(),
      done: false,
      doneAt: null,
      id: newId(),
      imagePath: null,
      kind: "text",
      section: "inbox",
      source,
      tags: [],
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

  const addImageCapture = (file: File) => {
    if (isTauriRuntime()) {
      fileToBase64(file)
        .then((bytesBase64) =>
          createImageCapture(bytesBase64, file.type || "image/png")
        )
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
        body: "",
        createdAt: Date.now(),
        done: false,
        doneAt: null,
        id: newId(),
        imagePath: dataUrl,
        kind: "image",
        section: "inbox",
        source: "Towdow",
        tags: [],
      };
      setCaptures((prev) => [capture, ...prev]);
      showToast("Captured");
    };
    reader.readAsDataURL(file);
  };

  const runCaptureNow = () => {
    if (isTauriRuntime()) {
      commands.captureNow().catch(() => {
        addCapture(
          "Simulated global capture — selection or clipboard.",
          "Safari"
        );
      });
      return;
    }
    addCapture("Simulated global capture — selection or clipboard.", "Safari");
  };

  const applyDone = (
    id: string,
    nextDone: boolean,
    nextDoneAt: number | null
  ) => {
    setCaptures((prev) =>
      prev.map((capture) =>
        capture.id === id
          ? { ...capture, done: nextDone, doneAt: nextDoneAt }
          : capture
      )
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleDone = (id: string) => {
    const current = captures.find((capture) => capture.id === id);
    if (!current || checkingIds.has(id)) {
      return;
    }
    const nextDone = !current.done;
    const nextDoneAt = nextDone ? Date.now() : null;

    const persist = () => {
      if (isTauriRuntime()) {
        setCaptureDone(id, nextDone, nextDoneAt)
          .then(() => {
            applyDone(id, nextDone, nextDoneAt);
          })
          .catch(() => undefined);
        return;
      }
      applyDone(id, nextDone, nextDoneAt);
    };

    // Completing: show the check briefly, then move. Restore is immediate.
    if (nextDone) {
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
    const trimmed = body.trim();
    if (trimmed.length === 0) {
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

  const copySelected = async () => {
    const lines = active
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
      <div className="flex h-svh items-center justify-center bg-muted/45 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative flex h-svh flex-col bg-muted/45">
      <CaptureToast message={toastMessage} visible={toastVisible} />

      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Capture menu"
              className="size-10 shrink-0 rounded-full active:scale-[0.96]"
              size="icon"
              title="Capture menu"
              type="button"
              variant="secondary"
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
              <ClipboardIcon />
              Capture selection / clipboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Inbox sort</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                if (value === "oldest" || value === "newest") {
                  setSort(value);
                }
              }}
              value={inboxSort}
            >
              <DropdownMenuRadioItem value="oldest">
                Oldest first
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="newest">
                Newest first
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
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
      </header>

      <ScrollArea className="min-h-0 flex-1">
        {/* Padding lives inside the viewport so ring/shadow aren't clipped on LR edges */}
        <LayoutGroup id="towdow-captures">
          <div className="flex flex-col gap-2.5 px-4 py-3 pb-6">
            {isVacant ? (
              <div className="flex flex-col items-start gap-2 px-2 py-14 text-muted-foreground">
                <p className="font-medium text-foreground text-sm">
                  Your capture inbox is empty
                </p>
                <p className="max-w-[16rem] text-sm leading-relaxed">
                  Drop something in below, or grab text from any app with{" "}
                  <KbdGroup className="mx-0.5 inline-flex">
                    <Kbd>⇧</Kbd>
                    <Kbd>⇧</Kbd>
                  </KbdGroup>
                  .
                </p>
              </div>
            ) : null}

            {noMatches ? (
              <p className="px-2 py-8 text-muted-foreground text-sm">
                Nothing matches “{query}”.
              </p>
            ) : null}

            <AnimatePresence initial={false} mode="popLayout">
              {active.map((capture) => (
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={
                    sharedLayout || reduceMotion
                      ? undefined
                      : {
                          opacity: 0,
                          scale: 0.97,
                          transition: LIST_EXIT_TRANSITION,
                          y: -6,
                        }
                  }
                  initial={
                    sharedLayout || reduceMotion
                      ? false
                      : { opacity: 0, scale: 0.98, y: 6 }
                  }
                  key={capture.id}
                  layout={layoutEnabled ? "position" : false}
                  layoutId={sharedLayout ? capture.id : undefined}
                  transition={LIST_LAYOUT_TRANSITION}
                >
                  <CaptureCard
                    capture={capture}
                    checking={checkingIds.has(capture.id)}
                    onCopied={() => {
                      showToast("Copied");
                    }}
                    onSave={saveCapture}
                    onToggleDone={toggleDone}
                    onToggleSelect={toggleSelect}
                    selected={selectedIds.has(capture.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {done.length > 0 || doneOpen ? (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, transition: LIST_EXIT_TRANSITION, y: -4 }
                  }
                  initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                  key="done-section"
                  layout={layoutEnabled ? "position" : false}
                  transition={LIST_LAYOUT_TRANSITION}
                >
                  <Accordion
                    collapsible
                    onValueChange={(value) => {
                      setDoneOpen(value === "done");
                    }}
                    type="single"
                    value={doneOpen ? "done" : ""}
                  >
                    <AccordionItem className="mt-2 border-0" value="done">
                      <AccordionTrigger className="px-1 py-2 text-[11px] text-muted-foreground tracking-[0.1em] hover:no-underline">
                        DONE
                        {done.length > 0 ? (
                          <span className="ml-1.5 font-normal tracking-normal opacity-70">
                            {done.length}
                          </span>
                        ) : null}
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col gap-2.5 px-0.5 pt-1.5">
                        {done.length === 0 ? (
                          <p className="px-1 text-muted-foreground text-sm">
                            Nothing completed yet.
                          </p>
                        ) : (
                          done.map((capture) => (
                            <motion.div
                              key={capture.id}
                              layout={sharedLayout ? "position" : false}
                              layoutId={sharedLayout ? capture.id : undefined}
                              transition={LIST_LAYOUT_TRANSITION}
                            >
                              <CaptureCard
                                capture={capture}
                                onCopied={() => {
                                  showToast("Copied");
                                }}
                                onSave={saveCapture}
                                onToggleDone={toggleDone}
                                onToggleSelect={toggleSelect}
                                selected={selectedIds.has(capture.id)}
                              />
                            </motion.div>
                          ))
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </LayoutGroup>
      </ScrollArea>

      <footer className="flex flex-col gap-2 pt-1 pb-4">
        <CapturePermissions />
        {selectedIds.size > 0 ? (
          <div className="fade-in slide-in-from-bottom-1 mx-4 flex animate-in items-center justify-between rounded-2xl bg-foreground px-3.5 py-2.5 text-background text-sm duration-150">
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
        <div className="px-4">
          <CaptureComposer
            onPasteImage={addImageCapture}
            onSubmit={(body) => {
              addCapture(body);
            }}
          />
        </div>
      </footer>
    </div>
  );
}
