import { CaptureCard } from "@/components/capture-card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import type { Capture } from "@/lib/types.ts";

interface CaptureSectionProps {
  captures: readonly Capture[];
  label: string;
  onSaveBody: (id: string, body: string) => void;
  onToggleDone: (id: string) => void;
  onToggleSelect: (id: string) => void;
  selectedIds: ReadonlySet<string>;
}

export function CaptureSection({
  label,
  captures,
  selectedIds,
  onToggleDone,
  onToggleSelect,
  onSaveBody,
}: CaptureSectionProps) {
  if (captures.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3 px-1">
        <h2 className="font-medium text-[11px] text-muted-foreground tracking-[0.08em]">
          {label}
        </h2>
        <Separator className="flex-1" />
      </div>
      <div className="flex flex-col gap-2.5">
        {captures.map((capture) => (
          <CaptureCard
            capture={capture}
            key={capture.id}
            onSaveBody={onSaveBody}
            onToggleDone={onToggleDone}
            onToggleSelect={onToggleSelect}
            selected={selectedIds.has(capture.id)}
          />
        ))}
      </div>
    </section>
  );
}
