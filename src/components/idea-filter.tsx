"use client";

import { useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { activeFilterCount, FILTER_GROUPS, filterSummary, parseFilter, type IdeaFilter } from "@/core/filters";
import { cn } from "@/lib/cn";

// The filter lives on the device (each of you has your own), the same in every list.
const KEY = "dom_filter";
const EVENT = "dom-filter-change";
const EMPTY: IdeaFilter = {};

let cache: { raw: string | null; value: IdeaFilter } = { raw: null, value: EMPTY };

function read(): IdeaFilter {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // private mode / blocked storage: no filter
  }
  // Same string → same object, so useSyncExternalStore does not loop.
  if (raw !== cache.raw) cache = { raw, value: raw ? parseFilter(raw) : EMPTY };
  return cache.value;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setIdeaFilter(filter: IdeaFilter) {
  try {
    if (activeFilterCount(filter) === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(filter));
  } catch {
    // not stored – it still applies until the page is left
    cache = { raw: JSON.stringify(filter), value: filter };
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useIdeaFilter(): [IdeaFilter, (filter: IdeaFilter) => void] {
  const filter = useSyncExternalStore(subscribe, read, () => EMPTY);
  return [filter, setIdeaFilter];
}

/** The one "Filter" button: opens a sheet with three questions. */
export function FilterButton({ className }: { className?: string }) {
  const [filter, setFilter] = useIdeaFilter();
  const sheet = useRef<SheetHandle>(null);
  const count = activeFilterCount(filter);
  return (
    <>
      <button
        type="button"
        onClick={() => sheet.current?.open()}
        aria-label={count ? `Filter: ${filterSummary(filter)}` : "Filter"}
        className={cn(
          "tap inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold",
          count ? "bg-ink text-bg" : "bg-surface text-ink",
          className,
        )}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {count ? <span className="max-w-[11rem] truncate">{filterSummary(filter)}</span> : "Filter"}
      </button>
      <Sheet ref={sheet} title="Filter">
        <p className="-mt-2 text-sm text-muted">Gilt überall: Wunschliste, Swipen, Was läuft und beim Planen.</p>
        {FILTER_GROUPS.map((group) => (
          <fieldset key={group.key} className="flex flex-col gap-2">
            <legend className="mb-2 text-[13px] font-medium text-muted">{group.question}</legend>
            <div className="flex flex-wrap gap-2">
              {[{ value: undefined, label: "Egal" }, ...group.options].map((option) => {
                const selected = filter[group.key] === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter({ ...filter, [group.key]: option.value })}
                    className={cn("tap h-10 rounded-full px-4 font-semibold", selected ? "bg-ink text-bg" : "bg-soft text-ink")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <Button variant="secondary" disabled={count === 0} onClick={() => setFilter({})}>
            Zurücksetzen
          </Button>
          <Button onClick={() => sheet.current?.close()}>Fertig</Button>
        </div>
      </Sheet>
    </>
  );
}

/** Shown instead of a list when the filter hides everything. */
export function FilteredEmpty({ what }: { what: string }) {
  const [filter, setFilter] = useIdeaFilter();
  return (
    <div className="flex flex-col items-center gap-2 rounded-[20px] border-[1.5px] border-dashed border-line px-5 py-6 text-center">
      <p className="font-bold">Keine {what} für „{filterSummary(filter)}“.</p>
      <button type="button" onClick={() => setFilter({})} className="text-sm font-semibold underline">
        Filter zurücksetzen
      </button>
    </div>
  );
}
