import { SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import type { InboxSort } from "@/lib/types.ts";
import { cn } from "@/lib/utils.ts";

interface CaptureSettingsProps {
  copySetsInProgress: boolean;
  inboxSort: InboxSort;
  inProgressEnabled: boolean;
  onCopySetsInProgressChange: (enabled: boolean) => void;
  onInboxSortChange: (sort: InboxSort) => void;
  onInProgressEnabledChange: (enabled: boolean) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function CaptureSettings({
  copySetsInProgress,
  inboxSort,
  inProgressEnabled,
  onCopySetsInProgressChange,
  onInboxSortChange,
  onInProgressEnabledChange,
  open,
  onOpenChange,
}: CaptureSettingsProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button
          aria-label="Settings"
          className="size-10 shrink-0 rounded-full active:scale-[0.96]"
          size="icon"
          title="Settings"
          type="button"
          variant="secondary"
        >
          <SettingsIcon className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md" showCloseButton>
        <DialogHeader className="gap-1 px-5 pt-5 pb-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Inbox order and optional In Progress workflow.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex flex-col gap-6 px-5 py-5">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-sm">Inbox</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Sort active captures by when they were created.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/70 p-1">
              <SortOption
                label="Oldest first"
                onSelect={() => {
                  onInboxSortChange("oldest");
                }}
                pressed={inboxSort === "oldest"}
              />
              <SortOption
                label="Newest first"
                onSelect={() => {
                  onInboxSortChange("newest");
                }}
                pressed={inboxSort === "newest"}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-sm">Workflow</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Add an In Progress stage between inbox and Done.
              </p>
            </div>

            <SettingRow
              checked={inProgressEnabled}
              description="Checkbox advances inbox → In Progress → Done. Restore from Done returns to In Progress."
              id="in-progress-enabled"
              label="Enable In Progress"
              onCheckedChange={onInProgressEnabledChange}
            />

            <SettingRow
              checked={copySetsInProgress}
              description="Copying an inbox capture also moves it to In Progress."
              disabled={!inProgressEnabled}
              id="copy-sets-in-progress"
              label="Copy sets In Progress"
              onCheckedChange={onCopySetsInProgressChange}
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SortOptionProps {
  label: string;
  onSelect: () => void;
  pressed: boolean;
}

function SortOption({ label, onSelect, pressed }: SortOptionProps) {
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "rounded-lg px-3 py-2 text-center text-sm transition-colors",
        pressed
          ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-black/5"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  );
}

interface SettingRowProps {
  checked: boolean;
  description: string;
  disabled?: boolean;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

function SettingRow({
  checked,
  description,
  disabled = false,
  id,
  label,
  onCheckedChange,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        disabled && "opacity-45"
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label className="font-medium text-sm" htmlFor={id}>
          {label}
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
