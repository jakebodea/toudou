import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Kbd, KbdGroup } from "@/components/ui/kbd.tsx";

interface CaptureShortcutsDialogProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface ShortcutRow {
  keys: string[];
  label: string;
}

const ROWS: ShortcutRow[] = [
  { keys: ["↑", "↓"], label: "Move focus in list" },
  { keys: ["→"], label: "Edit focused capture" },
  { keys: ["Enter"], label: "Copy (and In Progress if enabled)" },
  { keys: ["Space"], label: "Advance status" },
  { keys: ["⌫"], label: "Delete focused" },
  { keys: ["x"], label: "Toggle multi-select" },
  { keys: ["/"], label: "Focus search" },
  { keys: ["n"], label: "Focus composer" },
  { keys: ["d"], label: "Toggle Done section" },
  { keys: ["Esc"], label: "Clear selection / blur" },
  { keys: ["?"], label: "This cheatsheet" },
];

export function CaptureShortcutsDialog({
  open,
  onOpenChange,
}: CaptureShortcutsDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Works when you are not typing in search, composer, or an editor.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2.5">
          {ROWS.map((row) => (
            <li
              className="flex items-center justify-between gap-4 text-sm"
              key={row.label}
            >
              <span className="text-muted-foreground">{row.label}</span>
              <KbdGroup>
                {row.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
