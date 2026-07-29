import type { Theme } from "@/lib/types.ts";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/** Resolve preference to a concrete palette. */
export function resolvedTheme(theme: Theme): "light" | "dark" {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? "dark" : "light";
}

/** Apply palette class + native color-scheme on <html>. */
export function applyTheme(theme: Theme): void {
  const resolved = resolvedTheme(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/** Re-apply when OS light/dark preference changes. */
export function subscribeSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(SYSTEM_DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    media.removeEventListener("change", onChange);
  };
}
