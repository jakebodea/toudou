import { SettingsIcon } from "lucide-react";
import { useState } from "react";
import {
  SettingsBody,
  type SettingsBodyProps,
} from "@/components/settings-body.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { openSettingsWindow } from "@/lib/settings-window.ts";
import { isTauriRuntime } from "@/lib/storage.ts";

interface CaptureSettingsProps extends SettingsBodyProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export function CaptureSettings({
  onOpenChange,
  open,
  ...settingsProps
}: CaptureSettingsProps) {
  if (isTauriRuntime()) {
    return <SettingsTrigger />;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>
        <SettingsTrigger />
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-md" showCloseButton>
        <DialogHeader className="gap-1 px-5 pt-5 pb-4">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Appearance, inbox order, and optional In Progress workflow.
          </DialogDescription>
        </DialogHeader>

        <SettingsBody {...settingsProps} />
      </DialogContent>
    </Dialog>
  );
}

function SettingsTrigger() {
  const [opening, setOpening] = useState(false);

  return (
    <Button
      aria-label="Settings"
      className="size-10 shrink-0 rounded-full hover:bg-foreground/12 active:scale-[0.96] aria-expanded:bg-foreground/12 dark:aria-expanded:bg-foreground/15 dark:hover:bg-foreground/15"
      disabled={opening}
      onClick={() => {
        if (!isTauriRuntime()) {
          return;
        }
        setOpening(true);
        void openSettingsWindow().finally(() => {
          setOpening(false);
        });
      }}
      size="icon"
      title="Settings"
      type="button"
      variant="ghost"
    >
      <SettingsIcon className="size-4" />
    </Button>
  );
}
