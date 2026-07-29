import type { Theme } from "@/lib/types.ts";

/** Apply palette class + native color-scheme on <html>. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}
