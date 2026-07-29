import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { stripTrailingDashes } from "@/lib/captures.ts";

export interface CaretPoint {
  x: number;
  y: number;
}

interface CaptureEditorProps {
  caretPoint?: CaretPoint | null;
  initialMarkdown: string;
  onCancel: () => void;
  onChange: (markdown: string) => void;
  onCommit: () => void;
}

function readMarkdown(editor: Editor): string {
  const storage = editor.storage as unknown as {
    markdown: { getMarkdown: () => string };
  };
  return stripTrailingDashes(storage.markdown.getMarkdown().trimEnd());
}

function focusAtPoint(editor: Editor, point: CaretPoint | null | undefined) {
  if (point) {
    const coords = editor.view.posAtCoords({
      left: point.x,
      top: point.y,
    });
    if (coords) {
      editor.chain().focus().setTextSelection(coords.pos).run();
      return;
    }
  }
  editor.commands.focus("end");
}

export function CaptureEditor({
  caretPoint = null,
  initialMarkdown,
  onCancel,
  onChange,
  onCommit,
}: CaptureEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const onCancelRef = useRef(onCancel);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);
  onCancelRef.current = onCancel;
  onChangeRef.current = onChange;
  onCommitRef.current = onCommit;

  const editor = useEditor({
    content: initialMarkdown,
    editorProps: {
      attributes: {
        "aria-label": "Edit capture",
        class: "outline-none",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancelRef.current();
          return true;
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const { current } = editorRef;
          if (current) {
            onChangeRef.current(readMarkdown(current));
            onCommitRef.current();
          }
          return true;
        }
        return false;
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Write…",
      }),
      Markdown.configure({
        html: false,
        transformCopiedText: true,
        transformPastedText: true,
      }),
    ],
    onBlur: ({ editor: current }) => {
      onChangeRef.current(readMarkdown(current));
      onCommitRef.current();
    },
    onUpdate: ({ editor: current }) => {
      onChangeRef.current(readMarkdown(current));
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) {
      return;
    }
    // Double rAF: wait until the editor has replaced the view and laid out.
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        focusAtPoint(editor, caretPoint);
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [editor, caretPoint]);

  return (
    <div className="typeset typeset-capture capture-editor">
      <EditorContent className="contents" editor={editor} />
    </div>
  );
}
