import { CaptureShell } from "@/components/capture-shell.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";

export default function App() {
  return (
    <TooltipProvider delayDuration={400}>
      <CaptureShell />
    </TooltipProvider>
  );
}
