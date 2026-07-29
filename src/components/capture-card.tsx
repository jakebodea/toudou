import { useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { Capture } from "@/lib/types.ts";
import { cn } from "@/lib/utils.ts";

interface CaptureCardProps {
  capture: Capture;
  onSaveBody: (id: string, body: string) => void;
  onToggleDone: (id: string) => void;
  onToggleSelect: (id: string) => void;
  selected: boolean;
}

export function CaptureCard({
  capture,
  selected,
  onToggleDone,
  onToggleSelect,
  onSaveBody,
}: CaptureCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(capture.body);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl bg-background px-3.5 py-3 shadow-sm ring-1 transition-shadow",
          selected ? "ring-foreground/20" : "ring-black/5",
          capture.done && "opacity-70"
        )}
      >
        <Checkbox
          aria-label={capture.done ? "Restore capture" : "Mark done"}
          checked={capture.done}
          className="mt-0.5 size-5 rounded-full"
          onCheckedChange={() => {
            onToggleDone(capture.id);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
        <button
          className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey) {
              onToggleSelect(capture.id);
              return;
            }
            setDraft(capture.body);
            setExpanded((prev) => !prev);
          }}
          type="button"
        >
          <p
            className={cn(
              "whitespace-pre-wrap text-[15px] leading-snug",
              capture.done && "text-muted-foreground"
            )}
          >
            {capture.body}
          </p>
          <p className="text-muted-foreground text-xs">{capture.source}</p>
        </button>
      </div>

      {expanded ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-background p-3 shadow-sm ring-1 ring-black/5">
          <Textarea
            className="min-h-24 resize-none rounded-xl"
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            value={draft}
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onSaveBody(capture.id, draft);
                setExpanded(false);
              }}
              size="sm"
              type="button"
            >
              Save
            </Button>
            <Button
              onClick={() => {
                setDraft(capture.body);
                setExpanded(false);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
