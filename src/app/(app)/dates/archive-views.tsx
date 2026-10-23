"use client";

// Stiel | Raster (ARCHIV.md §1): one tap switches at once (both are rendered by the server), the choice is remembered
// in a cookie – the next visit opens the same view – and in the URL (back and reload keep it).
import { useState, type ReactNode } from "react";
import { ARCHIVE_VIEW_COOKIE, type ArchiveView } from "@/core/archive";
import { cn } from "@/lib/cn";


function remember(view: ArchiveView) {
  document.cookie = `${ARCHIVE_VIEW_COOKIE}=${view}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  const url = new URL(window.location.href);
  url.searchParams.set("ansicht", view);
  window.history.replaceState(window.history.state, "", url);
}

export function ArchiveViews({ initial, stem, grid, again }: { initial: ArchiveView; stem: ReactNode; grid: ReactNode; again: ReactNode }) {
  const [view, setView] = useState<ArchiveView>(initial);
  function pick(next: ArchiveView) {
    setView(next);
    remember(next);
  }
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Ansicht" className="inline-flex rounded-full bg-surface p-[3px]">
          {(["stiel", "raster"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => pick(v)}
              className={cn("h-8 rounded-full px-3.5 text-[13px] font-bold", view === v ? "bg-cta text-[#111A14]" : "text-ink")}
            >
              {v === "stiel" ? "Stiel" : "Raster"}
            </button>
          ))}
        </div>
        {again}
      </div>
      {view === "stiel" ? stem : grid}
    </>
  );
}
