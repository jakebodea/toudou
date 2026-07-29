import { useState } from "react";
import { Input } from "@/components/ui/input.tsx";

interface CaptureComposerProps {
  onPasteImage: (file: File) => void;
  onSubmit: (body: string) => void;
}

function imageFileFromClipboard(data: DataTransfer | null): File | null {
  if (!data) {
    return null;
  }
  for (const item of data.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  for (const file of data.files) {
    if (file.type.startsWith("image/")) {
      return file;
    }
  }
  return null;
}

export function CaptureComposer({
  onSubmit,
  onPasteImage,
}: CaptureComposerProps) {
  const [value, setValue] = useState("");

  return (
    <form
      onPaste={(event) => {
        const file = imageFileFromClipboard(event.clipboardData);
        if (!file) {
          return;
        }
        event.preventDefault();
        onPasteImage(file);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const next = value.trim();
        if (next.length === 0) {
          return;
        }
        onSubmit(next);
        setValue("");
      }}
    >
      <Input
        aria-label="Add a note or a prompt"
        className="h-10 rounded-full border-0 bg-background/90 px-4 shadow-sm ring-1 ring-black/5 transition-[box-shadow] duration-150 focus-visible:shadow-md focus-visible:ring-foreground/10"
        onChange={(event) => {
          setValue(event.target.value);
        }}
        placeholder="Add a note, prompt, or paste an image"
        value={value}
      />
    </form>
  );
}
