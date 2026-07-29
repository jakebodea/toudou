import { Button } from "@/components/ui/button.tsx";

export default function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/40 p-8">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-background p-8 shadow-sm">
        <h1 className="font-semibold text-2xl tracking-tight">Towdow</h1>
        <p className="text-muted-foreground text-sm">
          Tauri 2 + React + shadcn scaffold. Copper shell comes next.
        </p>
        <Button className="rounded-full" type="button" variant="secondary">
          Ready
        </Button>
      </div>
    </main>
  );
}
