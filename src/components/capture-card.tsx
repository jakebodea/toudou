import { PencilIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { parseTags } from "@/lib/captures.ts";
import { captureImageSrc } from "@/lib/storage.ts";
import type { Capture } from "@/lib/types.ts";
import { cn } from "@/lib/utils.ts";

interface CaptureCardProps {
  capture: Capture;
  /** Checked UI before the card moves to Done. */
  checking?: boolean;
  onCopied?: () => void;
  onSave: (id: string, body: string, tags: string[]) => void;
  onToggleDone: (id: string) => void;
  onToggleSelect: (id: string) => void;
  selected: boolean;
}

interface CaptureBodyProps {
  capture: Capture;
  draft: string;
  editing: boolean;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onCopy: () => void;
  onDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onToggleSelect: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

function CaptureBody({
  capture,
  draft,
  editing,
  onCancelEdit,
  onCommitEdit,
  onCopy,
  onDraftChange,
  onStartEdit,
  onToggleSelect,
  textareaRef,
}: CaptureBodyProps) {
  const imageSrc = captureImageSrc(capture);

  if (capture.kind === "image") {
    return (
      <button
        className="w-full text-left"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey) {
            onToggleSelect();
            return;
          }
          onCopy();
        }}
        type="button"
      >
        {imageSrc ? (
          <img
            alt=""
            className="h-48 w-full rounded-xl object-cover"
            draggable={false}
            height={192}
            src={imageSrc}
            width={320}
          />
        ) : (
          <p className="text-[15px] text-muted-foreground">Attachment</p>
        )}
      </button>
    );
  }

  if (editing && !capture.done) {
    return (
      <Textarea
        aria-label="Edit capture"
        className={cn(
          "min-h-0 resize-none rounded-none border-0 bg-transparent p-0 text-[15px] leading-snug shadow-none",
          "focus-visible:border-transparent focus-visible:ring-0",
          "md:text-[15px]",
          capture.done &&
            "text-muted-foreground line-through decoration-foreground/15"
        )}
        onBlur={onCommitEdit}
        onChange={(event) => {
          onDraftChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancelEdit();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        ref={textareaRef}
        value={draft}
      />
    );
  }

  return (
    <button
      className="text-left"
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey) {
          onToggleSelect();
          return;
        }
        onCopy();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        if (!capture.done) {
          onStartEdit();
        }
      }}
      type="button"
    >
      <p
        className={cn(
          "whitespace-pre-wrap text-[15px] leading-snug",
          capture.done &&
            "text-muted-foreground line-through decoration-foreground/15"
        )}
      >
        {capture.body}
      </p>
    </button>
  );
}

interface CaptureTagsProps {
  addingTag: boolean;
  done: boolean;
  onAddingTag: (open: boolean) => void;
  onCancelTag: () => void;
  onCommitTag: () => void;
  onTagDraftChange: (value: string) => void;
  source: string;
  tagDraft: string;
  tagInputRef: RefObject<HTMLInputElement | null>;
  tags: string[];
}

function CaptureTags({
  addingTag,
  done,
  onAddingTag,
  onCancelTag,
  onCommitTag,
  onTagDraftChange,
  source,
  tagDraft,
  tagInputRef,
  tags,
}: CaptureTagsProps) {
  return (
    <div className="group/tags flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground/70">{source}</span>
      {tags.length > 0 ? (
        <span className="text-[11px] text-muted-foreground/35">·</span>
      ) : null}
      {tags.map((tag) => (
        <Badge
          className="h-5 rounded-full border-border/60 bg-transparent px-2 font-normal text-[10px] text-muted-foreground/90"
          key={tag}
          variant="outline"
        >
          {tag}
        </Badge>
      ))}
      {done ? null : (
        <TagAddControl
          addingTag={addingTag}
          onAddingTag={onAddingTag}
          onCancelTag={onCancelTag}
          onCommitTag={onCommitTag}
          onTagDraftChange={onTagDraftChange}
          tagDraft={tagDraft}
          tagInputRef={tagInputRef}
        />
      )}
    </div>
  );
}

interface TagAddControlProps {
  addingTag: boolean;
  onAddingTag: (open: boolean) => void;
  onCancelTag: () => void;
  onCommitTag: () => void;
  onTagDraftChange: (value: string) => void;
  tagDraft: string;
  tagInputRef: RefObject<HTMLInputElement | null>;
}

function TagAddControl({
  addingTag,
  onAddingTag,
  onCancelTag,
  onCommitTag,
  onTagDraftChange,
  tagDraft,
  tagInputRef,
}: TagAddControlProps) {
  if (addingTag) {
    return (
      <input
        aria-label="New tag"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className="h-5 max-w-36 rounded-full border border-muted-foreground/40 border-dashed bg-transparent px-2 text-[10px] text-muted-foreground leading-none outline-none placeholder:text-muted-foreground/45"
        onBlur={onCommitTag}
        onChange={(event) => {
          onTagDraftChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommitTag();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancelTag();
          }
        }}
        placeholder="tag"
        ref={tagInputRef}
        spellCheck={false}
        style={{
          width: `${Math.max(tagDraft.length, 3) + 2}ch`,
        }}
        value={tagDraft}
      />
    );
  }

  return (
    <button
      className={cn(
        "inline-flex h-5 items-center rounded-full border border-muted-foreground/35 border-dashed px-2 font-normal text-[10px] text-muted-foreground/70",
        "opacity-0 transition-opacity group-hover/tags:opacity-100",
        "hover:border-muted-foreground/55 hover:text-muted-foreground",
        "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      )}
      onClick={() => {
        onAddingTag(true);
      }}
      type="button"
    >
      Add tag
    </button>
  );
}

export function CaptureCard({
  capture,
  checking = false,
  selected,
  onCopied,
  onToggleDone,
  onToggleSelect,
  onSave,
}: CaptureCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capture.body);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const skipBodyBlur = useRef(false);
  const skipTagBlur = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(capture.body);
    }
  }, [capture.body, editing]);

  useEffect(() => {
    if (editing) {
      textareaRef.current?.focus();
      const el = textareaRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    }
  }, [editing]);

  useEffect(() => {
    if (addingTag) {
      tagInputRef.current?.focus();
    }
  }, [addingTag]);

  useEffect(() => {
    if (!capture.done) {
      return;
    }
    skipBodyBlur.current = true;
    setDraft(capture.body);
    setEditing(false);
    skipTagBlur.current = true;
    setTagDraft("");
    setAddingTag(false);
  }, [capture.done, capture.body]);

  const startEdit = () => {
    if (capture.done || capture.kind === "image") {
      return;
    }
    setDraft(capture.body);
    setEditing(true);
  };

  const cancelEdit = () => {
    skipBodyBlur.current = true;
    setDraft(capture.body);
    setEditing(false);
  };

  const commitEdit = () => {
    if (skipBodyBlur.current) {
      skipBodyBlur.current = false;
      return;
    }
    const next = draft.trim();
    if (next.length === 0) {
      setDraft(capture.body);
      setEditing(false);
      return;
    }
    if (next !== capture.body) {
      onSave(capture.id, next, capture.tags);
    }
    setEditing(false);
  };

  const copyBody = () => {
    if (capture.kind === "image") {
      const src = captureImageSrc(capture);
      if (!src) {
        return;
      }
      fetch(src)
        .then((response) => response.blob())
        .then((blob) =>
          navigator.clipboard.write([
            new ClipboardItem({ [blob.type || "image/png"]: blob }),
          ])
        )
        .then(() => {
          onCopied?.();
        })
        .catch(() => undefined);
      return;
    }
    navigator.clipboard.writeText(capture.body).then(
      () => {
        onCopied?.();
      },
      () => undefined
    );
  };

  const cancelTag = () => {
    skipTagBlur.current = true;
    setTagDraft("");
    setAddingTag(false);
  };

  const commitTag = () => {
    if (skipTagBlur.current) {
      skipTagBlur.current = false;
      return;
    }
    if (capture.done) {
      setTagDraft("");
      setAddingTag(false);
      return;
    }
    const nextTags = parseTags(tagDraft);
    if (nextTags.length === 0) {
      setTagDraft("");
      setAddingTag(false);
      return;
    }
    const merged = [...new Set([...capture.tags, ...nextTags])];
    onSave(capture.id, capture.body, merged);
    setTagDraft("");
    setAddingTag(false);
  };

  return (
    <div
      className={cn(
        "rounded-2xl bg-background shadow-sm ring-1",
        selected ? "ring-foreground/25" : "ring-black/5",
        capture.done && "opacity-65"
      )}
      data-capture-id={capture.id}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <Checkbox
          aria-label={capture.done ? "Restore capture" : "Mark done"}
          checked={capture.done || checking}
          className={cn(
            "mt-0.5 size-5 rounded-full transition-transform duration-150 ease-out",
            "motion-reduce:transition-none",
            (capture.done || checking) && "scale-105"
          )}
          disabled={checking}
          onCheckedChange={() => {
            onToggleDone(capture.id);
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <CaptureBody
            capture={capture}
            draft={draft}
            editing={editing}
            onCancelEdit={cancelEdit}
            onCommitEdit={commitEdit}
            onCopy={copyBody}
            onDraftChange={setDraft}
            onStartEdit={startEdit}
            onToggleSelect={() => {
              onToggleSelect(capture.id);
            }}
            textareaRef={textareaRef}
          />
          <CaptureTags
            addingTag={addingTag}
            done={capture.done}
            onAddingTag={setAddingTag}
            onCancelTag={cancelTag}
            onCommitTag={commitTag}
            onTagDraftChange={setTagDraft}
            source={capture.source}
            tagDraft={tagDraft}
            tagInputRef={tagInputRef}
            tags={capture.tags}
          />
        </div>
        {editing || capture.done || capture.kind === "image" ? null : (
          <Button
            aria-label="Edit capture"
            className="mt-0.5 shrink-0 text-muted-foreground"
            onClick={startEdit}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            <PencilIcon />
          </Button>
        )}
      </div>
    </div>
  );
}
