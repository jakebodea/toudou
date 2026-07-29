import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app.tsx";
import { readTheme } from "./lib/preferences.ts";
import { applyTheme } from "./lib/theme.ts";
import "./index.css";

applyTheme(readTheme());

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
