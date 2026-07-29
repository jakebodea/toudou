import { PlusIcon } from "lucide-react";
import { useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";

interface CaptureComposerProps {
  onSubmit: (body: string) => void;
}

export function CaptureComposer({ onSubmit }: CaptureComposerProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  return (
    <form
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
      <InputGroup className="h-11 rounded-2xl bg-background shadow-sm">
        <InputGroupAddon align="inline-start">
          <InputGroupButton
            aria-label="Submit note"
            size="icon-xs"
            type="submit"
            variant="secondary"
          >
            <PlusIcon />
          </InputGroupButton>
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Add a note or a prompt"
          onBlur={() => {
            setFocused(false);
          }}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onFocus={() => {
            setFocused(true);
          }}
          placeholder="Add a note or a prompt"
          value={value}
        />
        {focused && value.trim().length === 0 ? (
          <InputGroupAddon align="inline-end">
            <Kbd className="hidden sm:inline-flex">↵</Kbd>
          </InputGroupAddon>
        ) : null}
      </InputGroup>
    </form>
  );
}
