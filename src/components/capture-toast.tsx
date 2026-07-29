import { cn } from "@/lib/utils.ts";

interface CaptureToastProps {
  message?: string;
  visible: boolean;
}

export function CaptureToast({
  message = "Captured",
  visible,
}: CaptureToastProps) {
  return (
    <div
      aria-hidden={!visible}
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-[5.75rem] z-50 flex justify-center",
        "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "motion-reduce:transition-none",
        visible
          ? "translate-y-0 opacity-100"
          : "invisible translate-y-1 opacity-0"
      )}
    >
      <div className="rounded-full bg-foreground px-3.5 py-1.5 text-background text-sm shadow-lg">
        {message}
      </div>
    </div>
  );
}
