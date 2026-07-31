import { XIcon } from "lucide-react";
import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CaptureEditor,
  type CaretPoint,
} from "@/components/capture-editor.tsx";
import { CaptureMarkdown } from "@/components/capture-markdown.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu.tsx";
import { parseTags } from "@/lib/captures.ts";
import { copyCaptureContent } from "@/lib/inbox-keyboard.ts";
import {
  captureImageSrc,
  isTauriRuntime,
  quickLookImage,
} from "@/lib/storage.ts";
import {
  type Capture,
  type CaptureStatus,
  captureStatus,
  nextStatus,
} from "@/lib/types.ts";
import { cn } from "@/lib/utils.ts";

interface CaptureCardProps {
  capture: Capture;
  /** Checked UI before the card moves to Done. */
  checking?: boolean;
  /** Keyboard asks this card to enter edit mode when id matches and key advances. */
  editRequest?: { id: string; key: number } | null;
  /** Keyboard list focus (distinct from multi-select). */
  focused?: boolean;
  inProgressEnabled?: boolean;
  onCopied?: () => void;
  onDelete: (id: string) => void;
  onFilterTag: (tag: string) => void;
  onFocusCapture: (id: string) => void;
  onSave: (id: string, body: string, tags: string[]) => void;
  onSetStatus: (id: string, status: CaptureStatus) => void;
  onToggleSelect: (id: string) => void;
  selected: boolean;
}

interface CaptureBodyProps {
  capture: Capture;
  caretPoint: CaretPoint | null;
  draft: string;
  editing: boolean;
  /** List keyboard focus owns Enter/Space; body only handles them when tabbed to. */
  listFocused: boolean;
  onCancelEdit: () => void;
  onCommitEdit: () => void;
  onCopyContent: () => void;
  onDraftChange: (value: string) => void;
  onOpenImage: () => void;
  onStartEdit: (point?: CaretPoint) => void;
  onToggleSelect: () => void;
}

function CaptureMediaPreview({
  kind,
  onCopyContent,
  src,
}: {
  kind: "image" | "video";
  onCopyContent?: () => void;
  src: string | null;
}) {
  if (!src) {
    return <p className="text-[15px] text-muted-foreground">Attachment</p>;
  }
  if (kind === "video") {
    return (
      <video
        aria-label="Video attachment"
        className="h-48 w-full max-w-xl rounded-xl border-2 border-border/80 bg-muted/30 object-cover p-0.5 shadow-sm"
        controls
        muted
        onContextMenu={(event) => {
          event.preventDefault();
          onCopyContent?.();
        }}
        playsInline
        preload="metadata"
        src={src}
      />
    );
  }
  return (
    <img
      alt=""
      className="h-48 w-full max-w-xl rounded-xl border-2 border-border/80 bg-muted/30 object-cover p-0.5 shadow-sm"
      draggable={false}
      height={192}
      src={src}
      width={320}
    />
  );
}

function CaptureBody({
  capture,
  caretPoint,
  draft,
  editing,
  listFocused,
  onCancelEdit,
  onCommitEdit,
  onCopyContent,
  onDraftChange,
  onOpenImage,
  onStartEdit,
  onToggleSelect,
}: CaptureBodyProps) {
  const imageSrc = captureImageSrc(capture);
  const mediaKind =
    capture.kind === "image" || capture.kind === "video" ? capture.kind : null;
  const hasMedia = mediaKind !== null;
  const openImage = (event: MouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey) {
      onToggleSelect();
      return;
    }
    onOpenImage();
  };

  const copyMediaContent = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onCopyContent();
  };
  let mediaAttachment: ReactNode = null;
  if (mediaKind === "image") {
    mediaAttachment = (
      <button
        className="w-full max-w-xl text-left"
        onClick={openImage}
        onContextMenu={copyMediaContent}
        type="button"
      >
        <CaptureMediaPreview kind={mediaKind} src={imageSrc} />
      </button>
    );
  } else if (mediaKind === "video") {
    mediaAttachment = (
      <CaptureMediaPreview
        kind={mediaKind}
        onCopyContent={onCopyContent}
        src={imageSrc}
      />
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {mediaAttachment}

      {editing && !capture.done ? (
        <CaptureEditor
          caretPoint={caretPoint}
          initialMarkdown={draft}
          onCancel={onCancelEdit}
          onChange={onDraftChange}
          onCommit={onCommitEdit}
        />
      ) : null}

      {!editing && (capture.body.length > 0 || !hasMedia) ? (
        // Markdown may include links/inputs; a <button> wrapper would nest interactives.
        // biome-ignore lint/a11y/useSemanticElements: div hosts rendered markdown safely
        <div
          className="cursor-text text-left"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey) {
              onToggleSelect();
              return;
            }
            if (!capture.done) {
              onStartEdit({ x: event.clientX, y: event.clientY });
            }
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            onCopyContent();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }
            // List shortcuts handle these when the card has keyboard focus.
            if (listFocused && !event.metaKey && !event.ctrlKey) {
              return;
            }
            event.preventDefault();
            if (event.metaKey || event.ctrlKey) {
              onToggleSelect();
              return;
            }
            if (!capture.done) {
              onStartEdit();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <CaptureMarkdown done={capture.done}>{capture.body}</CaptureMarkdown>
        </div>
      ) : null}
    </div>
  );
}

interface CaptureTagsProps {
  addingTag: boolean;
  done: boolean;
  onAddingTag: (open: boolean) => void;
  onCancelTag: () => void;
  onCommitTag: () => void;
  onFilterTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
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
  onFilterTag,
  onRemoveTag,
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
          className="group/tag h-5 rounded-full border-border/60 bg-transparent py-0 pr-2 pl-2 font-normal text-[10px] text-muted-foreground/90 transition-[padding] duration-150 ease-out hover:bg-muted/60 hover:pr-1 hover:text-foreground has-[:focus-visible]:pr-1"
          key={tag}
          variant="outline"
        >
          <button
            className="max-w-36 truncate outline-none"
            onClick={(event) => {
              event.stopPropagation();
              onFilterTag(tag);
            }}
            type="button"
          >
            {tag}
          </button>
          <button
            aria-label={`Remove ${tag}`}
            className={cn(
              "inline-flex h-3.5 w-0 shrink-0 items-center justify-center overflow-hidden rounded-full text-muted-foreground/70",
              "opacity-0 transition-[width,opacity,margin] duration-150 ease-out",
              "hover:bg-foreground/8 hover:text-foreground",
              "group-hover/tag:ml-0.5 group-hover/tag:w-3.5 group-hover/tag:opacity-100",
              "focus-visible:ml-0.5 focus-visible:w-3.5 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50"
            )}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveTag(tag);
            }}
            type="button"
          >
            <XIcon className="size-2.5 shrink-0" />
          </button>
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

function checkboxAriaLabel(
  status: CaptureStatus,
  inProgressEnabled: boolean
): string {
  if (!inProgressEnabled) {
    return status === "done" ? "Restore capture" : "Mark done";
  }
  switch (status) {
    case "active":
      return "Mark in progress";
    case "in_progress":
      return "Mark done";
    case "done":
      return "Restore to in progress";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled capture status: ${_exhaustive}`);
    }
  }
}

export function CaptureCard({
  capture,
  checking = false,
  editRequest = null,
  focused = false,
  inProgressEnabled = false,
  selected,
  onCopied,
  onDelete,
  onFilterTag,
  onFocusCapture,
  onSetStatus,
  onToggleSelect,
  onSave,
}: CaptureCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capture.body);
  const [caretPoint, setCaretPoint] = useState<CaretPoint | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const draftRef = useRef(capture.body);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const skipBodyBlur = useRef(false);
  const skipTagBlur = useRef(false);
  const lastEditRequestKey = useRef(0);
  const status = captureStatus(capture);
  const isInProgress = status === "in_progress";
  const isDone = status === "done" || checking;

  useEffect(() => {
    if (!editing) {
      draftRef.current = capture.body;
      setDraft(capture.body);
    }
  }, [capture.body, editing]);

  useEffect(() => {
    if (addingTag) {
      tagInputRef.current?.focus();
    }
  }, [addingTag]);

  useEffect(() => {
    if (!editRequest || editRequest.id !== capture.id || capture.done) {
      return;
    }
    if (editRequest.key === lastEditRequestKey.current) {
      return;
    }
    lastEditRequestKey.current = editRequest.key;
    skipBodyBlur.current = false;
    draftRef.current = capture.body;
    setDraft(capture.body);
    setCaretPoint(null);
    setEditing(true);
  }, [capture.body, capture.done, capture.id, editRequest]);

  useEffect(() => {
    if (!capture.done) {
      return;
    }
    skipBodyBlur.current = true;
    draftRef.current = capture.body;
    setDraft(capture.body);
    setCaretPoint(null);
    setEditing(false);
    skipTagBlur.current = true;
    setTagDraft("");
    setAddingTag(false);
  }, [capture.done, capture.body]);

  const startEdit = (point?: CaretPoint) => {
    if (capture.done) {
      return;
    }
    skipBodyBlur.current = false;
    draftRef.current = capture.body;
    setDraft(capture.body);
    setCaretPoint(point ?? null);
    setEditing(true);
  };

  const cancelEdit = () => {
    skipBodyBlur.current = true;
    draftRef.current = capture.body;
    setDraft(capture.body);
    setCaretPoint(null);
    setEditing(false);
  };

  const commitEdit = () => {
    if (skipBodyBlur.current) {
      skipBodyBlur.current = false;
      return;
    }
    const next = draftRef.current.trim();
    if (next.length === 0 && capture.kind !== "image") {
      skipBodyBlur.current = true;
      draftRef.current = capture.body;
      setDraft(capture.body);
      setCaretPoint(null);
      setEditing(false);
      return;
    }
    if (next !== capture.body) {
      onSave(capture.id, next, capture.tags);
    }
    skipBodyBlur.current = true;
    setCaretPoint(null);
    setEditing(false);
  };

  const handleDraftChange = (value: string) => {
    draftRef.current = value;
    setDraft(value);
  };

  const copyContent = () => {
    copyCaptureContent(capture).then(
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

  const removeTag = (tag: string) => {
    const nextTags = capture.tags.filter((item) => item !== tag);
    onSave(capture.id, capture.body, nextTags);
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

  const checkbox = (
    <Checkbox
      aria-label={checkboxAriaLabel(status, inProgressEnabled)}
      checked={checking || status === "done"}
      className={cn(
        "mt-0.5 size-5 rounded-full transition-[transform,box-shadow,border-color] duration-150 ease-out",
        "motion-reduce:transition-none",
        isDone && "scale-105",
        isInProgress &&
          inProgressEnabled &&
          "shadow-[0_0_0_3px] shadow-foreground/20 ring-2 ring-foreground/35"
      )}
      disabled={checking}
      onCheckedChange={() => {
        onSetStatus(capture.id, nextStatus(status, inProgressEnabled));
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    />
  );

  return (
    <div
      className={cn(
        "rounded-2xl bg-background shadow-sm ring-1 transition-[box-shadow,ring] duration-150",
        selected ? "ring-foreground/25" : "ring-foreground/5",
        focused && "ring-2 ring-foreground/35",
        capture.done && "opacity-65",
        isInProgress && inProgressEnabled && "shadow-md ring-foreground/12"
      )}
      data-capture-id={capture.id}
      data-focused={focused ? "true" : undefined}
      onPointerDown={() => {
        onFocusCapture(capture.id);
      }}
    >
      <div className="flex items-start gap-3 px-3.5 py-3">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <span className="inline-flex">{checkbox}</span>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            {inProgressEnabled ? (
              <>
                <ContextMenuRadioGroup
                  onValueChange={(value) => {
                    if (
                      value === "active" ||
                      value === "in_progress" ||
                      value === "done"
                    ) {
                      onSetStatus(capture.id, value);
                    }
                  }}
                  value={status}
                >
                  <ContextMenuRadioItem value="active">
                    Inbox
                  </ContextMenuRadioItem>
                  <ContextMenuRadioItem value="in_progress">
                    In Progress
                  </ContextMenuRadioItem>
                  <ContextMenuRadioItem value="done">Done</ContextMenuRadioItem>
                </ContextMenuRadioGroup>
                <ContextMenuSeparator />
              </>
            ) : null}
            <ContextMenuItem
              onSelect={() => {
                onDelete(capture.id);
              }}
              variant="destructive"
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <CaptureBody
            capture={capture}
            caretPoint={caretPoint}
            draft={draft}
            editing={editing}
            listFocused={focused}
            onCancelEdit={cancelEdit}
            onCommitEdit={commitEdit}
            onCopyContent={copyContent}
            onDraftChange={handleDraftChange}
            onOpenImage={() => {
              if (capture.kind !== "image" || !capture.imagePath) {
                return;
              }
              if (isTauriRuntime()) {
                quickLookImage(capture.imagePath).catch(() => undefined);
                return;
              }
              const imageSrc = captureImageSrc(capture);
              if (imageSrc) {
                window.open(imageSrc, "_blank", "noopener");
              }
            }}
            onStartEdit={startEdit}
            onToggleSelect={() => {
              onToggleSelect(capture.id);
            }}
          />
          <CaptureTags
            addingTag={addingTag}
            done={capture.done}
            onAddingTag={setAddingTag}
            onCancelTag={cancelTag}
            onCommitTag={commitTag}
            onFilterTag={onFilterTag}
            onRemoveTag={removeTag}
            onTagDraftChange={setTagDraft}
            source={capture.source}
            tagDraft={tagDraft}
            tagInputRef={tagInputRef}
            tags={capture.tags}
          />
        </div>
      </div>
    </div>
  );
}
