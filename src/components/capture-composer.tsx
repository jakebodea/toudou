import { getCurrentWebview } from "@tauri-apps/api/webview";
import { FileIcon, ImagePlusIcon, XIcon } from "lucide-react";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group.tsx";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover.tsx";
import {
  activeHashQuery,
  extractComposerTags,
  filterTagSuggestions,
  normalizeTag,
  normalizeTags,
} from "@/lib/captures.ts";
import {
  type ComposerMedia,
  isNativeMedia,
  mediaFromPath,
  mediaKindFromFile,
} from "@/lib/media.ts";
import { getDroppedImagePreview, isTauriRuntime } from "@/lib/storage.ts";
import { cn } from "@/lib/utils.ts";

const LONE_HASH = /(^|\s)#(?=\s|$)/g;
const MULTI_SPACE = /\s+/g;

export interface CaptureComposerSubmit {
  body: string;
  media: ComposerMedia | null;
  tags: string[];
}

export interface CaptureComposerHandle {
  focus: () => void;
}

interface CaptureComposerProps {
  knownTags?: readonly string[];
  onSubmit: (payload: CaptureComposerSubmit) => void;
  ref?: Ref<CaptureComposerHandle>;
}

function isSupportedMedia(file: File): boolean {
  return mediaKindFromFile(file) !== null;
}

function mediaFileFromTransfer(data: DataTransfer | null): File | null {
  if (!data) {
    return null;
  }
  for (const item of data.items) {
    if (
      item.kind === "file" &&
      (item.type.startsWith("image/") || item.type.startsWith("video/"))
    ) {
      const file = item.getAsFile();
      if (file) {
        return file;
      }
    }
  }
  for (const file of data.files) {
    if (isSupportedMedia(file)) {
      return file;
    }
  }
  return null;
}

function PendingMediaPreview({
  media,
  previewUrl,
}: {
  media: ComposerMedia;
  previewUrl: string | null;
}) {
  if (!previewUrl) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-foreground/5">
        <FileIcon className="size-5" />
      </div>
    );
  }
  if (
    (isNativeMedia(media) && media.kind === "video") ||
    (!isNativeMedia(media) && media.type.startsWith("video/"))
  ) {
    return (
      <video
        aria-label="Pending video attachment"
        className="h-14 w-14 rounded-xl object-cover ring-1 ring-foreground/5"
        muted
        playsInline
        preload="metadata"
        src={previewUrl}
      />
    );
  }
  return (
    <img
      alt="Pending attachment"
      className="h-14 w-14 rounded-xl object-cover ring-1 ring-foreground/5"
      draggable={false}
      height={56}
      src={previewUrl}
      width={56}
    />
  );
}

function insertAtCaret(
  value: string,
  caret: number,
  selectionEnd: number,
  insertion: string
): { next: string; nextCaret: number } {
  const next = `${value.slice(0, caret)}${insertion}${value.slice(selectionEnd)}`;
  return { next, nextCaret: caret + insertion.length };
}

function stripLoneHash(value: string): string {
  LONE_HASH.lastIndex = 0;
  return value.replace(LONE_HASH, "$1").replace(MULTI_SPACE, " ").trim();
}

export function CaptureComposer({
  knownTags = [],
  onSubmit,
  ref,
}: CaptureComposerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [caret, setCaret] = useState(0);
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [pendingMedia, setPendingMedia] = useState<ComposerMedia | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const dragDepth = useRef(0);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  }));

  const hashQuery = useMemo(
    () => activeHashQuery(value, caret),
    [caret, value]
  );

  const availableTags = useMemo(
    () => knownTags.filter((tag) => !pendingTags.includes(tag)),
    [knownTags, pendingTags]
  );

  const suggestions = useMemo(() => {
    if (!hashQuery) {
      return [];
    }
    return filterTagSuggestions(availableTags, hashQuery.query);
  }, [availableTags, hashQuery]);

  const createTag = useMemo(() => {
    if (!hashQuery) {
      return null;
    }
    const next = normalizeTag(hashQuery.query);
    if (next.length === 0) {
      return null;
    }
    if (pendingTags.includes(next) || availableTags.includes(next)) {
      return null;
    }
    return next;
  }, [availableTags, hashQuery, pendingTags]);

  const optionTags = useMemo(() => {
    if (createTag) {
      return [...suggestions, createTag];
    }
    return suggestions;
  }, [createTag, suggestions]);

  const showSuggestions = hashQuery !== null && optionTags.length > 0;
  const safeHighlight =
    optionTags.length === 0 ? 0 : Math.min(highlight, optionTags.length - 1);
  const selectedOption = optionTags[safeHighlight] ?? "";

  useEffect(() => {
    if (!pendingMedia) {
      setPreviewUrl(null);
      return;
    }
    if (isNativeMedia(pendingMedia)) {
      if (pendingMedia.kind === "video") {
        setPreviewUrl(null);
        return;
      }
      let cancelled = false;
      getDroppedImagePreview(pendingMedia.path)
        .then((previewDataUrl) => {
          if (!cancelled) {
            setPreviewUrl(previewDataUrl);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPreviewUrl(null);
          }
        });
      return () => {
        cancelled = true;
      };
    }
    const url = URL.createObjectURL(pendingMedia);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [pendingMedia]);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    let unlisten: (() => void) | undefined;
    let disposed = false;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setIsDraggingMedia(true);
          return;
        }
        if (event.payload.type === "leave") {
          setIsDraggingMedia(false);
          return;
        }
        setIsDraggingMedia(false);
        const media = event.payload.paths
          .map(mediaFromPath)
          .find((item) => item !== null);
        if (media) {
          setPendingMedia(media);
        }
      })
      .then((nextUnlisten) => {
        if (disposed) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const clearPendingMedia = () => {
    setPendingMedia(null);
  };

  const syncCaret = (el: HTMLTextAreaElement) => {
    setCaret(el.selectionStart ?? el.value.length);
  };

  const focusCaret = (nextCaret: number) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) {
        return;
      }
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const applyTag = (rawTag: string) => {
    const tag = normalizeTag(rawTag);
    const query = activeHashQuery(value, caret);
    if (!query || tag.length === 0) {
      return;
    }

    setPendingTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));

    const before = value.slice(0, query.start);
    const after = value.slice(caret);
    const next = `${before}${after}`;
    const nextCaret = before.length;
    setValue(next);
    setCaret(nextCaret);
    setHighlight(0);
    focusCaret(nextCaret);
  };

  const removeTag = (tag: string) => {
    setPendingTags((prev) => prev.filter((item) => item !== tag));
    inputRef.current?.focus();
  };

  const closeTagMenu = () => {
    const query = activeHashQuery(value, caret);
    if (!query) {
      return;
    }
    const before = value.slice(0, query.start);
    const after = value.slice(caret);
    const next = `${before}${after}`;
    const nextCaret = before.length;
    setValue(next);
    setCaret(nextCaret);
    setHighlight(0);
    focusCaret(nextCaret);
  };

  const submit = () => {
    const parsed = extractComposerTags(stripLoneHash(value));
    const tags = normalizeTags([...pendingTags, ...parsed.tags]);
    if (parsed.body.length === 0 && !pendingMedia) {
      return;
    }
    onSubmit({
      body: parsed.body,
      media: pendingMedia,
      tags,
    });
    setValue("");
    setCaret(0);
    setPendingTags([]);
    setPendingMedia(null);
  };

  const handleEnter = () => {
    if (hashQuery) {
      if (optionTags.length > 0) {
        applyTag(selectedOption);
        return;
      }
      const typed = normalizeTag(hashQuery.query);
      if (typed.length > 0) {
        applyTag(typed);
        return;
      }
    }
    submit();
  };

  return (
    <Popover open={showSuggestions}>
      <PopoverAnchor asChild>
        {/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: The composer form accepts dropped media files. */}
        <form
          className="flex flex-col gap-1.5"
          onDragEnter={(event) => {
            if (!event.dataTransfer.types.includes("Files")) {
              return;
            }
            event.preventDefault();
            dragDepth.current += 1;
            setIsDraggingMedia(true);
          }}
          onDragLeave={(event) => {
            if (!event.dataTransfer.types.includes("Files")) {
              return;
            }
            dragDepth.current -= 1;
            if (dragDepth.current <= 0) {
              dragDepth.current = 0;
              setIsDraggingMedia(false);
            }
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(event) => {
            dragDepth.current = 0;
            setIsDraggingMedia(false);
            if (!event.dataTransfer.types.includes("Files")) {
              return;
            }
            event.preventDefault();
            const file = mediaFileFromTransfer(event.dataTransfer);
            if (file) {
              setPendingMedia(file);
            }
          }}
          onPaste={(event) => {
            const file = mediaFileFromTransfer(event.clipboardData);
            if (!file) {
              return;
            }
            setPendingMedia(file);
            if (!event.clipboardData.getData("text")) {
              event.preventDefault();
            }
          }}
          onSubmit={(event) => {
            event.preventDefault();
            handleEnter();
          }}
          ref={formRef}
        >
          {pendingTags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 px-1">
              {pendingTags.map((tag) => (
                <Badge
                  className="h-6 gap-1 rounded-full border-border/60 bg-background/80 pr-1 font-normal text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm"
                  key={tag}
                  variant="outline"
                >
                  #{tag}
                  <button
                    aria-label={`Remove ${tag}`}
                    className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-foreground/8 hover:text-foreground"
                    onClick={() => {
                      removeTag(tag);
                    }}
                    type="button"
                  >
                    <XIcon className="size-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
          <InputGroup
            className={cn(
              "h-auto min-h-10 rounded-2xl border-0 bg-background/90 shadow-sm ring-1 ring-foreground/5 transition-[box-shadow] duration-150 has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:shadow-md has-[[data-slot=input-group-control]:focus-visible]:ring-foreground/10",
              isDraggingMedia && "ring-2 ring-foreground/35"
            )}
          >
            {pendingMedia ? (
              <InputGroupAddon align="block-start">
                <div className="flex items-start gap-2">
                  <PendingMediaPreview
                    media={pendingMedia}
                    previewUrl={previewUrl}
                  />
                  <Button
                    aria-label="Remove attachment"
                    className="size-7 shrink-0 rounded-full text-muted-foreground"
                    onClick={clearPendingMedia}
                    size="icon-xs"
                    type="button"
                    variant="ghost"
                  >
                    <XIcon />
                  </Button>
                </div>
              </InputGroupAddon>
            ) : null}
            <InputGroupTextarea
              aria-expanded={showSuggestions}
              aria-label="Add a note or a prompt"
              className="field-sizing-content max-h-40 min-h-10 px-3 py-2.5 md:text-sm"
              onChange={(event) => {
                const next = event.target.value;
                setValue(next);
                const nextCaret = event.target.selectionStart ?? next.length;
                setCaret(nextCaret);
                setHighlight(0);
              }}
              onClick={(event) => {
                syncCaret(event.currentTarget);
              }}
              onFocus={(event) => {
                syncCaret(event.currentTarget);
              }}
              onKeyDown={(event) => {
                const el = event.currentTarget;
                const selectionStart = el.selectionStart ?? caret;
                const selectionEnd = el.selectionEnd ?? selectionStart;
                const hashActive =
                  activeHashQuery(value, selectionStart) !== null;

                if (event.key === "Escape" && hashActive) {
                  event.preventDefault();
                  closeTagMenu();
                  return;
                }
                if (event.key === " " && hashActive) {
                  event.preventDefault();
                  const { next, nextCaret } = insertAtCaret(
                    value,
                    selectionStart,
                    selectionEnd,
                    "-"
                  );
                  setValue(next);
                  setCaret(nextCaret);
                  setHighlight(0);
                  focusCaret(nextCaret);
                  return;
                }
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleEnter();
                  return;
                }
                if (!showSuggestions) {
                  return;
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlight((prev) => (prev + 1) % optionTags.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlight(
                    (prev) => (prev - 1 + optionTags.length) % optionTags.length
                  );
                }
              }}
              onPaste={(event) => {
                const el = event.currentTarget;
                const selectionStart = el.selectionStart ?? caret;
                const selectionEnd = el.selectionEnd ?? selectionStart;
                if (activeHashQuery(value, selectionStart) === null) {
                  return;
                }
                const text = event.clipboardData?.getData("text");
                if (!text) {
                  return;
                }
                event.preventDefault();
                const insertion = text
                  .replace(MULTI_SPACE, "-")
                  .replace(/#/g, "");
                const { next, nextCaret } = insertAtCaret(
                  value,
                  selectionStart,
                  selectionEnd,
                  insertion
                );
                setValue(next);
                setCaret(nextCaret);
                setHighlight(0);
                focusCaret(nextCaret);
              }}
              onSelect={(event) => {
                syncCaret(event.currentTarget);
              }}
              placeholder={
                pendingTags.length > 0
                  ? "Keep writing, or # for another tag"
                  : "Add a note, #tag, or drop media"
              }
              ref={inputRef}
              rows={1}
              spellCheck
              value={value}
            />
            {isDraggingMedia ? (
              <InputGroupAddon align="inline-end">
                <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  <ImagePlusIcon className="size-3.5" />
                  Drop image or video
                </span>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </form>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="min-w-56 p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onFocusOutside={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
        }}
        side="top"
        sideOffset={8}
        style={{ width: formRef.current?.offsetWidth }}
      >
        <Command shouldFilter={false} value={selectedOption}>
          <CommandList className="max-h-48">
            <CommandEmpty>No matching tags</CommandEmpty>
            <CommandGroup heading="Tags">
              {suggestions.map((tag) => (
                <CommandItem
                  data-checked={tag === selectedOption ? true : undefined}
                  key={tag}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onSelect={() => {
                    applyTag(tag);
                  }}
                  value={tag}
                >
                  <span className="text-muted-foreground">#</span>
                  {tag}
                </CommandItem>
              ))}
              {createTag ? (
                <CommandItem
                  data-checked={createTag === selectedOption ? true : undefined}
                  key={`create:${createTag}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onSelect={() => {
                    applyTag(createTag);
                  }}
                  value={createTag}
                >
                  Create #{createTag}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
