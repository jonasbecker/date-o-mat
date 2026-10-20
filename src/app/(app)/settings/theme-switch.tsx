"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

export const THEME_KEY = "dom_theme";
type Theme = "system" | "light" | "dark";
const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: "system", label: "Automatisch" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

function read(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("dom-theme-change", onChange);
  return () => window.removeEventListener("dom-theme-change", onChange);
}

/** Hell / Dunkel / Automatisch – stored on this device, applied as data-theme on <html> (see layout.tsx). */
export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);
  function choose(next: Theme) {
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // not stored – it still applies until the page is left
    }
    const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    window.dispatchEvent(new Event("dom-theme-change"));
  }
  return (
    <div role="radiogroup" aria-label="Darstellung" className="grid grid-cols-3 gap-1 rounded-full bg-soft p-1">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          onClick={() => choose(option.value)}
          className={cn("h-10 rounded-full text-[15px] font-semibold", theme === option.value ? "bg-tinte text-white dark:bg-leaf" : "text-ink")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
