import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { MoreHorizontalIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CaptureCard } from "@/components/capture-card.tsx";
import { CaptureComposer } from "@/components/capture-composer.tsx";
import { CapturePermissions } from "@/components/capture-permissions.tsx";
import { CaptureSection } from "@/components/capture-section.tsx";
import { CaptureToast } from "@/components/capture-toast.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import {
  activeBySection,
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
} from "@/lib/storage.ts";
import type { Capture } from "@/lib/types.ts";
import { SECTION_LABEL } from "@/lib/types.ts";

const TOAST_MS = 1200;
const DAY_MS = 24 * 60 * 60 * 1000;

export function CaptureShell() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [toastVisible, setToastVisible] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);

  const prompts = useMemo(
    () => activeBySection(captures, "prompts", query),
    [captures, query]
  );
  const links = useMemo(
    () => activeBySection(captures, "links", query),
    [captures, query]
  );
  const inbox = useMemo(
    () => activeBySection(captures, "inbox", query),
    [captures, query]
  );
  const done = useMemo(() => doneCaptures(captures, query), [captures, query]);
  const isEmpty =
    prompts.length + links.length + inbox.length + done.length === 0;

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
            if (!cancelled) {
              setCaptures(rows);
              setToastVisible(true);
              window.setTimeout(() => {
                setToastVisible(false);
              }, TOAST_MS);
            }
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

  const showToast = () => {
    setToastVisible(true);
    window.setTimeout(() => {
      setToastVisible(false);
    }, TOAST_MS);
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
          showToast();
        })
        .catch(() => undefined);
      return;
    }

    setCaptures((prev) => [capture, ...prev]);
    showToast();
  };

  const toggleDone = (id: string) => {
    const current = captures.find((capture) => capture.id === id);
    if (!current) {
      return;
    }
    const nextDone = !current.done;
    const nextDoneAt = nextDone ? Date.now() : null;

    const apply = () => {
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

    if (isTauriRuntime()) {
      setCaptureDone(id, nextDone, nextDoneAt)
        .then(apply)
        .catch(() => undefined);
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

  const saveBody = (id: string, body: string) => {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
      return;
    }

    const apply = () => {
      setCaptures((prev) =>
        prev.map((capture) =>
          capture.id === id ? { ...capture, body: trimmed } : capture
        )
      );
    };

    if (isTauriRuntime()) {
      updateCaptureBody(id, trimmed)
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
      <div className="flex h-svh items-center justify-center bg-muted/50 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative flex h-svh flex-col bg-muted/50">
      <CaptureToast visible={toastVisible} />

      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Input
          aria-label="Search"
          className="h-10 rounded-full border-0 bg-background/80 shadow-sm ring-1 ring-black/5"
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search"
          value={query}
        />
        <Button
          aria-label="Capture now"
          className="size-10 shrink-0 rounded-full"
          onClick={() => {
            if (isTauriRuntime()) {
              invoke("capture_now").catch(() => {
                addCapture(
                  "Simulated global capture — selection or clipboard.",
                  "Safari"
                );
              });
              return;
            }
            addCapture(
              "Simulated global capture — selection or clipboard.",
              "Safari"
            );
          }}
          size="icon"
          type="button"
          variant="secondary"
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="flex flex-col gap-5 py-3 pb-6">
          {isEmpty ? (
            <div className="flex flex-col gap-1.5 px-2 py-10 text-muted-foreground text-sm">
              <p>Nothing here.</p>
              <p>Add a note below, or capture from anywhere.</p>
            </div>
          ) : null}

          <CaptureSection
            captures={prompts}
            label={SECTION_LABEL.prompts}
            onSaveBody={saveBody}
            onToggleDone={toggleDone}
            onToggleSelect={toggleSelect}
            selectedIds={selectedIds}
          />
          <CaptureSection
            captures={links}
            label={SECTION_LABEL.links}
            onSaveBody={saveBody}
            onToggleDone={toggleDone}
            onToggleSelect={toggleSelect}
            selectedIds={selectedIds}
          />
          <CaptureSection
            captures={inbox}
            label={SECTION_LABEL.inbox}
            onSaveBody={saveBody}
            onToggleDone={toggleDone}
            onToggleSelect={toggleSelect}
            selectedIds={selectedIds}
          />

          <Accordion
            collapsible
            onValueChange={(value) => {
              setDoneOpen(value === "done");
            }}
            type="single"
            value={doneOpen ? "done" : ""}
          >
            <AccordionItem className="border-0" value="done">
              <AccordionTrigger className="px-1 py-2 text-[11px] text-muted-foreground tracking-[0.08em] hover:no-underline">
                DONE
              </AccordionTrigger>
              <AccordionContent className="flex flex-col gap-2.5">
                {done.length === 0 ? (
                  <p className="px-1 text-muted-foreground text-sm">
                    Nothing completed yet.
                  </p>
                ) : (
                  done.map((capture) => (
                    <CaptureCard
                      capture={capture}
                      key={capture.id}
                      onSaveBody={saveBody}
                      onToggleDone={toggleDone}
                      onToggleSelect={toggleSelect}
                      selected={selectedIds.has(capture.id)}
                    />
                  ))
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>

      <footer className="flex flex-col gap-2 pt-1 pb-4">
        <CapturePermissions />
        {selectedIds.size > 0 ? (
          <div className="mx-4 flex items-center justify-between rounded-2xl bg-foreground px-3.5 py-2.5 text-background text-sm">
            <span>{selectedIds.size} selected</span>
            <Button
              className="h-8 rounded-full bg-background text-foreground hover:bg-background/90"
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
