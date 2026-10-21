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
/** `round`: only the icon in a 44 px circle (the swipe page); the label stays for screen readers. */
export function FilterButton({ className, round = false }: { className?: string; round?: boolean }) {
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
          "tap inline-flex shrink-0 items-center rounded-full text-[13px] font-semibold",
          round ? "relative size-11 justify-center" : "hit h-8 gap-1.5 px-3",
          count ? "bg-ink text-bg" : "bg-surface text-ink",
          className,
        )}
      >
        <svg width={round ? 18 : 15} height={round ? 18 : 15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={round ? 2 : 2.6} strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        {!round && (count ? <span className="max-w-[11rem] truncate">{filterSummary(filter)}</span> : "Filter")}
        {round && count > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-like text-[10px] font-bold text-white">{count}</span>}
      </button>
      <Sheet ref={sheet} title="Filter">
        <p className="-mt-2 text-sm text-muted">Gilt überall: Wunschliste, Swipen, Was läuft und beim Planen.</p>
        <FilterQuestions />
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

/**
 * The four questions of the filter (Wie lang? Was darf es kosten? Wo? Was für ein Date?), each with
 * "Egal" first. In the sheet behind the Filter button and as the first step of planning (`big` pills).
 */
export function FilterQuestions({ big = false }: { big?: boolean }) {
  const [filter, setFilter] = useIdeaFilter();
  return (
    <>
      {FILTER_GROUPS.map((group) => (
        <fieldset key={group.key} className="flex flex-col gap-2">
          <legend className={cn("mb-2 text-muted", big ? "text-sm font-semibold" : "text-[13px] font-medium")}>{group.question}</legend>
          <div className="flex flex-wrap gap-2">
            {[{ value: undefined, label: "Egal" }, ...group.options].map((option) => {
              const selected = filter[group.key] === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter({ ...filter, [group.key]: option.value })}
                  className={cn("tap rounded-full px-4 font-semibold", big ? "h-11 text-[15px]" : "h-10", selected ? "bg-ink text-bg" : big ? "bg-surface text-ink" : "bg-soft text-ink")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
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
