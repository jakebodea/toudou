import { Button } from "@/components/ui/button";

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/40 p-8">
      <div className="flex w-full max-w-sm flex-col gap-3 rounded-3xl bg-background p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Towdow</h1>
        <p className="text-sm text-muted-foreground">
          Tauri 2 + React + shadcn scaffold. Copper shell comes next.
        </p>
        <Button type="button" variant="secondary" className="rounded-full">
          Ready
        </Button>
      </div>
    </main>
  );
}

export default App;
