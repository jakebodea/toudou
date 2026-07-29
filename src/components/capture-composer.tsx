import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Input } from "@/components/ui/input.tsx";

interface CaptureComposerProps {
  onSubmit: (body: string) => void;
}

export function CaptureComposer({ onSubmit }: CaptureComposerProps) {
  const [value, setValue] = useState("");

  return (
    <form
      className="rounded-2xl bg-background px-3.5 py-3 shadow-sm ring-1 ring-black/5"
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
      <div className="flex items-center gap-3">
        <Checkbox
          aria-hidden
          checked={false}
          className="size-5 rounded-full opacity-40"
          disabled
          tabIndex={-1}
        />
        <Input
          aria-label="Add a note or a prompt"
          className="h-auto border-0 bg-transparent p-0 text-[15px] shadow-none focus-visible:ring-0"
          onChange={(event) => {
            setValue(event.target.value);
          }}
          placeholder="Add a note or a prompt"
          value={value}
        />
      </div>
    </form>
  );
}
