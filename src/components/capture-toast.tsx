import { cn } from "@/lib/utils.ts";

interface CaptureToastProps {
  visible: boolean;
}

export function CaptureToast({ visible }: CaptureToastProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-x-0 top-4 z-50 flex justify-center transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      )}
    >
      <div className="rounded-full bg-background/95 px-4 py-2 text-muted-foreground text-sm shadow-sm ring-1 ring-border/60 backdrop-blur">
        Captured
      </div>
    </div>
  );
}
