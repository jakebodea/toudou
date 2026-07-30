import { Button } from "@/components/ui/button.tsx";
import { useCapturePermissionStatus } from "@/hooks/use-capture-permission-status.ts";
import { commands } from "@/lib/bindings.ts";

interface PermissionSetupActionProps {
  buttonLabel: string;
  isGranted: boolean;
  label: string;
  onOpen: () => Promise<void>;
}

function PermissionSetupAction({
  buttonLabel,
  isGranted,
  label,
  onOpen,
}: PermissionSetupActionProps) {
  if (isGranted) {
    return <p className="text-foreground">{label} enabled ✓</p>;
  }

  return (
    <Button
      className="h-8 rounded-full"
      onClick={() => {
        void onOpen();
      }}
      size="sm"
      type="button"
      variant="secondary"
    >
      {buttonLabel}
    </Button>
  );
}

export function CapturePermissions() {
  const { refresh, status } = useCapturePermissionStatus();

  if (!status) {
    return null;
  }

  const needsHelp = !(status.accessibility && status.inputMonitoring);
  if (!needsHelp) {
    return null;
  }

  return (
    <div className="mx-4 mb-2 rounded-2xl bg-background px-3.5 py-3 text-muted-foreground text-sm shadow-sm ring-1 ring-foreground/5">
      <p className="leading-snug">
        Double-Shift needs two macOS permissions. Use the buttons to open
        Privacy &amp; Security, then turn toudou on under Accessibility and
        Input Monitoring.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PermissionSetupAction
          buttonLabel="Set up Accessibility"
          isGranted={status.accessibility}
          label="Accessibility"
          onOpen={async () => {
            await commands.requestAccessibilityPermission();
          }}
        />
        <PermissionSetupAction
          buttonLabel="Set up Input Monitoring"
          isGranted={status.inputMonitoring}
          label="Input Monitoring"
          onOpen={async () => {
            await commands.requestInputMonitoringPermission();
          }}
        />
        <Button
          className="h-8 rounded-full"
          onClick={() => {
            void refresh();
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Check again
        </Button>
      </div>
    </div>
  );
}
