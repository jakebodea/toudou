import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ClipboardIcon, MoreHorizontalIcon, SearchIcon } from "lucide-react";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Kbd, KbdGroup } from "@/components/ui/kbd.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import {
  activeCaptures,
  doneCaptures,
  newId,
  numberedList,
} from "@/lib/captures.ts";
import { seedCaptures } from "@/lib/seed.ts";
import {
  isTauriRuntime,
  listCaptures,
  createCapture as persistCreate,
  purgeExpiredDone,
  seedDemoCaptures,
  setCaptureDone,
  updateCaptureBody,
  updateCaptureTags,
} from "@/lib/storage.ts";
import type { Capture } from "@/lib/types.ts";

const TOAST_MS = 1200;
const COMPLETE_MS = 280;
const MOVE_MS = 320;
const MOVE_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const DAY_MS = 24 * 60 * 60 * 1000;

function measureCaptureCard(id: string): DOMRect | undefined {
  const el = document.querySelector(`[data-capture-id="${id}"]`);
  return el?.getBoundingClientRect();
}

/**
 * Fly a fixed clone from the card's pre-move rect to its new list slot.
 * Avoids AccordionContent overflow clipping a mid-FLIP transform.
 */
function flyCaptureCard(id: string, first: DOMRect | undefined) {
  if (!first) {
    return;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-capture-id="${id}"]`);
      if (!(el instanceof HTMLElement)) {
        return;
      }
      const last = el.getBoundingClientRect();
      const dx = last.left - first.left;
      const dy = last.top - first.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        return;
      }

      const clone = el.cloneNode(true);
      if (!(clone instanceof HTMLElement)) {
        return;
      }
      clone.removeAttribute("data-capture-id");
      clone.style.position = "fixed";
      clone.style.left = `${first.left}px`;
      clone.style.top = `${first.top}px`;
      clone.style.width = `${first.width}px`;
      clone.style.margin = "0";
      clone.style.zIndex = "50";
      clone.style.pointerEvents = "none";
      document.body.appendChild(clone);

      el.style.opacity = "0";
      const clear = () => {
        clone.remove();
        el.style.opacity = "";
      };
      const animation = clone.animate(
        [
          { transform: "translate(0px, 0px)" },
          { transform: `translate(${dx}px, ${dy}px)` },
        ],
        { duration: MOVE_MS, easing: MOVE_EASE, fill: "forwards" }
      );
      animation.finished.then(clear, clear);
    });
  });
}

export function CaptureShell() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("Captured");
  const [doneOpen, setDoneOpen] = useState(false);
  const [exitingIds, setExitingIds] = useState<Set<string>>(() => new Set());
  const [enteringIds, setEnteringIds] = useState<Set<string>>(() => new Set());
  const toastTimer = useRef<number | null>(null);

  const active = useMemo(
    () => activeCaptures(captures, query),
    [captures, query]
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
      (event) => {
        listCaptures()
          .then((rows) => {
            if (cancelled) {
              return;
            }
            setCaptures(rows);
            setEnteringIds((prev) => new Set(prev).add(event.payload.id));
            window.setTimeout(() => {
              setEnteringIds((prev) => {
                const next = new Set(prev);
                next.delete(event.payload.id);
                return next;
              });
            }, COMPLETE_MS);
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

  const pulseEnter = (id: string) => {
    setEnteringIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setEnteringIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, COMPLETE_MS);
  };

  const addCapture = (body: string, source = "Towdow") => {
    const capture: Capture = {
      body,
      createdAt: Date.now(),
      done: false,
      doneAt: null,
      id: newId(),
      section: "inbox",
      source,
      tags: [],
    };

    if (isTauriRuntime()) {
      persistCreate(capture)
        .then((saved) => {
          setCaptures((prev) => [saved, ...prev]);
          pulseEnter(saved.id);
          showToast();
        })
        .catch(() => undefined);
      return;
    }

    setCaptures((prev) => [capture, ...prev]);
    pulseEnter(capture.id);
    showToast();
  };

  const runCaptureNow = () => {
    if (isTauriRuntime()) {
      invoke("capture_now").catch(() => {
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
    setExitingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleDone = (id: string) => {
    const current = captures.find((capture) => capture.id === id);
    if (!current || exitingIds.has(id)) {
      return;
    }
    const nextDone = !current.done;
    const nextDoneAt = nextDone ? Date.now() : null;
    // When DONE is open, slide the card into/out of that section (FLIP).
    // When closed, keep the collapse-out exit on complete.
    const shouldFlip = doneOpen;
    const first = shouldFlip ? measureCaptureCard(id) : undefined;

    const persist = () => {
      const after = () => {
        applyDone(id, nextDone, nextDoneAt);
        if (shouldFlip) {
          flyCaptureCard(id, first);
        } else if (!nextDone) {
          pulseEnter(id);
        }
      };
      if (isTauriRuntime()) {
        setCaptureDone(id, nextDone, nextDoneAt)
          .then(after)
          .catch(() => undefined);
        return;
      }
      after();
    };

    if (nextDone && !shouldFlip) {
      setExitingIds((prev) => new Set(prev).add(id));
      window.setTimeout(persist, COMPLETE_MS);
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
    const bodies = captures
      .filter((capture) => selectedIds.has(capture.id) && !capture.done)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((capture) => capture.body);
    if (bodies.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(numberedList(bodies));
    setSelectedIds(new Set());
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

          {active.map((capture) => (
            <CaptureCard
              capture={capture}
              entering={enteringIds.has(capture.id)}
              exiting={exitingIds.has(capture.id)}
              key={capture.id}
              onCopied={() => {
                showToast("Copied");
              }}
              onSave={saveCapture}
              onToggleDone={toggleDone}
              onToggleSelect={toggleSelect}
              selected={selectedIds.has(capture.id)}
            />
          ))}

          {(done.length > 0 || doneOpen) && (
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
                      <CaptureCard
                        capture={capture}
                        key={capture.id}
                        onCopied={() => {
                          showToast("Copied");
                        }}
                        onSave={saveCapture}
                        onToggleDone={toggleDone}
                        onToggleSelect={toggleSelect}
                        selected={selectedIds.has(capture.id)}
                      />
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
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
            onSubmit={(body) => {
              addCapture(body);
            }}
          />
        </div>
      </footer>
    </div>
  );
}
