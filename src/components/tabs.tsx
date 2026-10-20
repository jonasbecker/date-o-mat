"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A row of tabs instead of one long page: one panel at a time. */
export function Tabs({ label, tabs, initial }: { label: string; tabs: Array<{ key: string; label: string; content: ReactNode }>; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.key);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={tab.key === active}
            aria-controls={`panel-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={cn("truncate rounded-full px-2 py-1.5 text-sm font-bold", tab.key === active ? "bg-green text-white" : "text-muted")}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" id={`panel-${tab.key}`} aria-labelledby={`tab-${tab.key}`} hidden={tab.key !== active} className="flex min-h-0 flex-1 flex-col gap-3">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
