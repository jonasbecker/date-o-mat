"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useOptimistic, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { SIZE_LABEL } from "@/components/size-chip";
import { categoryOf } from "@/core/categories";
import { slotModeFor } from "@/core/slot-modes";
import { orderSlots } from "@/core/slots";
import { FilteredEmpty, FilterButton, FilterQuestions, useIdeaFilter } from "@/components/idea-filter";
import { TopRow } from "@/components/app-header";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SurpriseButton } from "@/components/surprise-button";
import { SwapConfirm, type NextDateInfo } from "@/components/swap-confirm";
import { StepDots } from "@/components/step-dots";
import { QuickAdd } from "@/components/quick-add";
import { IdeaForm } from "@/components/idea-form";
import { archiveIdeaAction, updateIdeaAction } from "../ideas/actions";
import { Mascot } from "@/components/mascot";
import { BackIcon, DiceIcon, MoreIcon } from "@/components/icons";
import { type IdeaCardView } from "@/components/idea-card";
import { matchesIdeaFilter } from "@/core/filters";
import type { EventView } from "../events/event-list";
import { MoreIdeas } from "./more-ideas";
import { cn } from "@/lib/cn";
import { IDEA_SIZES, type IdeaSize } from "@/lib/domain";
import { budgetHint } from "@/core/budget";
import type { SlotView } from "@/lib/format";
import { freeTimesAction, saveDateAction, type FreeTimes, type SaveDateState } from "./actions";


export type IdeaOption = IdeaCardView;

/** `keepSecret`: someone else's surprise – the partner sees only the time. */
export type RescheduleInfo = { dateId: string; size: IdeaSize; title: string; keepSecret?: boolean };

/**
 * - new: pick an idea, then a time, then "Date festlegen".
 * - swap: a date is planned – the idea you tap takes its place (after a question).
 * - reschedule: only the time of an existing date changes.
 */
export type FlowMode = { kind: "new" } | { kind: "swap"; next: NextDateInfo & { ideaId: string | null } } | { kind: "reschedule"; date: RescheduleInfo };

/** `title`/`size` are known right away for ideas that were just put on the wishlist (before the page refreshed). */
type IdeaPick = { kind: "idea"; id: string; title?: string; size?: IdeaSize } | { kind: "custom" };

const SLOTS_PER_PAGE = 3;
const NO_SLOTS: SlotView[] = [];

const inputClass =
  "h-12 w-full rounded-2xl bg-soft px-4 font-medium text-ink placeholder:text-muted/70 focus:shadow-[0_0_0_3px_var(--color-himmel)] focus:outline-none";

/** Free times older than this are fetched again when step 2 opens. */
const TIMES_FRESH_MS = 60_000;

function isStale(loadedAt: number): boolean {
  return Date.now() - loadedAt > TIMES_FRESH_MS;
}

export function PlanFlow({
  mode,
  later = false,
  ideas: allIdeas,
  partnerName,
  searchScopeLink,
  preselectIdeaId,
  preselectSize,
  aiEnabled = false,
  surpriseEnabled = false,
  withEvents = false,
  budget = null,
  budgetLine,
  intro,
  hoursLeft,
}: {
  mode: FlowMode;
  /** "Auch nach dem Rundenende suchen": the whole horizon instead of the round. */
  later?: boolean;
  ideas: IdeaOption[];
  partnerName: string;
  /** "Auch nach dem Rundenende suchen" – rendered by the server page. */
  searchScopeLink?: ReactNode;
  /** From "Date damit planen" / a match: start at the time with this idea. */
  preselectIdeaId?: string;
  /** "Großes Date planen" (special days): long ideas and dates. */
  preselectSize?: IdeaSize;
  /** Show "✨ Ideen von der KI" (Claude is configured). */
  aiEnabled?: boolean;
  /** "🎁 Als Überraschung planen" – an extra that shows up after the first date. */
  surpriseEnabled?: boolean;
  /** Also load the events where both are free (for "Was anderes …"). */
  withEvents?: boolean;
  /** Month budget left and savings pot (null = no budget set). */
  budget?: { left: number; pot: number } | null;
  /** "Oktober: 50 von 80 € · noch 30 €" – next to "Date festlegen". */
  budgetLine?: ReactNode;
  /** What sits below the top bar (the state of the round). */
  intro?: ReactNode;
  /** "54 h" – time left until the deadline, top right. */
  hoursLeft?: string;
}) {
  const router = useRouter();
  // A deleted idea leaves the list at once – before the server answers.
  const [ideas, hideIdea] = useOptimistic(allIdeas, (current, id: string) => current.filter((i) => i.id !== id));
  const preselected = mode.kind === "new" && preselectIdeaId ? ideas.find((i) => i.id === preselectIdeaId) : undefined;
  // Filter ("worauf lust?") first, then "was?", then "wann?" – a match or a reschedule starts at the time.
  const [step, setStep] = useState<"filter" | "idea" | "time">(mode.kind === "reschedule" || preselected ? "time" : "filter");
  const [pick, setPick] = useState<IdeaPick | null>(preselected ? { kind: "idea", id: preselected.id } : null);
  const [size, setSize] = useState<IdeaSize>(mode.kind === "reschedule" ? mode.date.size : (preselected?.size ?? preselectSize ?? "small"));
  // The free times are loaded here, not by the page: the start page itself never waits for Google.
  const [times, setTimes] = useState<{ result: FreeTimes; at: number } | null>(null);
  const [loadingTimes, startLoadingTimes] = useTransition();
  const loadTimes = useCallback(() => {
    if (mode.kind === "swap") return;
    startLoadingTimes(async () => {
      const result = await freeTimesAction({ later, events: withEvents }).catch((): FreeTimes => ({ status: "google_error" }));
      setTimes({ result, at: Date.now() });
    });
  }, [mode.kind, later, withEvents]);
  useEffect(() => loadTimes(), [loadTimes]);
  const ok = times?.result.status === "ok" ? times.result : null;
  // Outdoor ideas get their own ranking: daylight and weather count (see core/outdoor.ts).
  const slotMode = pick?.kind === "idea" ? slotModeFor(ideas.find((i) => i.id === pick.id)) : "standard";
  const lists = ok ? (slotMode === "outdoor" ? ok.outdoor : slotMode === "outdoorDark" ? ok.outdoorDark : ok) : null;
  const small = lists ? orderSlots(lists.small) : NO_SLOTS;
  const large = lists ? orderSlots(lists.large) : NO_SLOTS;
  const events: EventView[] | null = ok?.events ?? null;
  const slots = size === "small" ? small : large;
  const [chosenSlot, setSlotKey] = useState<string | null>(null);
  // Until one is tapped: the Top-Tipp.
  const slotKey = chosenSlot && slots.some((s) => s.key === chosenSlot) ? chosenSlot : (slots[0]?.key ?? null);
  // Three times at a time – "Weitere Zeiten" turns the page instead of scrolling.
  const [slotPage, setSlotPage] = useState(0);
  const moreSheet = useRef<SheetHandle>(null);
  const swapSheet = useRef<SheetHandle>(null);
  const editSheet = useRef<SheetHandle>(null);
  const [editing, setEditing] = useState<IdeaOption | null>(null);
  function editIdea(idea: IdeaOption) {
    setEditing(idea);
    editSheet.current?.open();
  }
  const [swapping, setSwapping] = useState<{ id: string; title: string; size?: IdeaSize } | null>(null);
  const [filter] = useIdeaFilter();
  const [customTitle, setCustomTitle] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const celebrate = useCelebrate();
  const [leaving, setLeaving] = useState(false);
  const [surprise, setSurprise] = useState(false);
  const [moreKey, setMoreKey] = useState(0);

  const [state, formAction, pending] = useActionState<SaveDateState, FormData>(async (prev, formData) => {
    const result = await saveDateAction(prev, formData);
    if (result.status === "saved") {
      setLeaving(true);
      celebrate();
      // Back to the start, which now shows the date.
      setTimeout(() => router.replace("/plan"), 1000);
    }
    return result;
  }, { status: "idle" });

  function selectSize(next: IdeaSize) {
    setSize(next);
    setSlotKey(null);
    setSlotPage(0);
  }

  function toTimes() {
    setStep("time");
    if (!loadingTimes && (!times || isStale(times.at))) loadTimes();
  }

  /**
   * Picks an idea. A tap in the list only selects it ("Weiter" goes on); an explicit choice (Zufall,
   * an event, a suggestion) goes on right away. With a date planned: the question whether to swap.
   */
  function chooseIdea(chosen: { id: string; title?: string; size?: IdeaSize }, advance = true) {
    const known = ideas.find((i) => i.id === chosen.id);
    if (mode.kind === "swap") {
      setSwapping({ id: chosen.id, title: chosen.title ?? known?.title ?? "", size: chosen.size ?? known?.size });
      swapSheet.current?.open();
      return;
    }
    setPick({ kind: "idea", ...chosen });
    setCustomTitle("");
    setCustomLocation("");
    selectSize(chosen.size ?? known?.size ?? filter.size ?? size);
    if (advance) toTimes();
  }

  function chooseCustom() {
    setPick({ kind: "custom" });
    selectSize(filter.size ?? "small");
    toTimes();
  }

  const slot = slots.find((s) => s.key === slotKey);
  const idea = pick?.kind === "idea" ? (ideas.find((i) => i.id === pick.id) ?? (pick.title ? { id: pick.id, title: pick.title, size, costEur: null, location: null } : undefined)) : undefined;
  const title = mode.kind === "reschedule" ? mode.date.title : pick?.kind === "custom" ? customTitle.trim() : (idea?.title ?? "");
  const ready = Boolean(slot && title);
  const pickedCost = idea?.costEur ?? null;
  const budgetWarning = budget ? budgetHint(pickedCost, budget.left) : null;
  // Swapping: the date's own idea is not an alternative to itself.
  const wishlist = ideas.filter((i) => matchesIdeaFilter({ size: i.size, costEur: i.costEur, setting: i.setting, category: categoryOf(i) }, filter) && !(mode.kind === "swap" && i.id === mode.next.ideaId));
  const pageCount = Math.max(1, Math.ceil(slots.length / SLOTS_PER_PAGE));
  const shownSlots = slots.slice(slotPage * SLOTS_PER_PAGE, (slotPage + 1) * SLOTS_PER_PAGE);

  // The AI plans for your next free time (weather, length) – the Top-Tipp of the filtered length.
  const aiSlot = (filter.size === "large" ? large : small)[0];

  const slotsBlock =
    !times || (loadingTimes && !ok) ? (
      <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-3" aria-busy="true" aria-label="Sucht freie Zeiten …">
        <Mascot id="times" size={40} busy />
        <p className="text-sm text-muted">Eure freien Abende kommen gleich …</p>
      </div>
    ) : times.result.status === "google_error" ? (
      <p role="alert" className="rounded-2xl bg-rose px-4 py-3 text-sm font-medium text-tinte">
        Google Kalender antwortet gerade nicht.{" "}
        <button type="button" onClick={loadTimes} className="font-bold underline">
          Nochmal versuchen
        </button>
      </p>
    ) : times.result.status === "not_connected" ? (
      <p role="alert" className="rounded-2xl bg-zitrone-soft px-4 py-3 text-sm font-medium text-tinte">
        Ein Kalender ist nicht mehr verbunden.{" "}
        <Link href="/settings?t=kalender" className="font-bold underline">
          In den Einstellungen verbinden
        </Link>
      </p>
    ) : slots.length === 0 ? (
      <NoSlots size={size} />
    ) : (
      <ol className="flex flex-col gap-1.5" aria-label="Freie Zeiten">
        {shownSlots.map((option, i) => {
          const index = slotPage * SLOTS_PER_PAGE + i;
          const selected = option.key === slotKey;
          return (
            <li key={option.key} className="animate-pop-in">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`${option.dateLabel}, ${option.timeLabel}${index === 0 ? " · Top-Tipp" : ""}`}
                data-weekday={option.weekday}
                data-day={option.day}
                data-time={option.timeLabel}
                onClick={() => setSlotKey(option.key)}
                className={cn(
                  "tap grid min-h-[52px] w-full grid-cols-[78px_minmax(0,1fr)_auto] items-center rounded-2xl px-4 py-1.5 text-left",
                  selected ? "bg-tinte text-white dark:bg-leaf" : "bg-surface text-ink",
                )}
              >
                <span className="font-mono text-xs">{option.shortLabel}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-xl font-bold tracking-[-0.02em]">{option.timeLabel.replace(" – ", "–")}</span>
                  {option.note && <span className={cn("truncate text-[11px]", selected ? "opacity-80" : "text-muted")}>{option.note}</span>}
                </span>
                <span className="flex flex-col items-end font-mono text-[11px]">
                  {index === 0 && <span aria-hidden="true">★ Tipp</span>}
                  <span className={cn(!selected && "text-muted")}>{option.durationLabel}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    );

  const pager = ok && slots.length > 0 && (
    <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
      <button type="button" disabled={slotPage === 0} onClick={() => setSlotPage((p) => p - 1)} className={cn("underline", slotPage === 0 && "invisible")}>
        ← Frühere
      </button>
      <span className="font-mono text-[11px] text-muted">{ok && `Gesucht bis ${ok.untilLabel}`}</span>
      <button type="button" disabled={slotPage >= pageCount - 1} onClick={() => setSlotPage((p) => p + 1)} className={cn("underline", slotPage >= pageCount - 1 && "invisible")}>
        Weitere Zeiten →
      </button>
    </div>
  );

  const sizeToggle = (
    <div role="group" aria-label="Wie lang soll das Date sein?" className="flex gap-0.5 rounded-full bg-soft p-0.5">
      {IDEA_SIZES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={size === option}
          onClick={() => selectSize(option)}
          className={cn("rounded-full px-3 py-1 font-mono text-[11px]", size === option ? "bg-ink text-bg" : "text-muted")}
        >
          {SIZE_LABEL[option].label}
        </button>
      ))}
    </div>
  );

  // The ideas of "was?": matches first (DESIGN.md), then the order the page gave (longest waiting first).
  const sortedWishlist = [...wishlist].sort((a, b) => Number(Boolean(b.matched)) - Number(Boolean(a.matched)));
  const chosenId = mode.kind === "swap" ? null : pick?.kind === "idea" ? pick.id : null;
  const ideaList =
    ideas.length === 0 ? (
      <p className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-4 text-sm text-muted">Eure Wunschliste ist noch leer. Swipt ein paar Ideen – oder tragt eure eigene ein.</p>
    ) : wishlist.length === 0 ? (
      <FilteredEmpty what="Ideen" />
    ) : (
      <ul data-scroll className="-mx-1 flex min-h-[7rem] flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1 pb-1" aria-label="Eure Wunschliste">
        {pick?.kind === "custom" && (
          <li>
            <div className="flex min-h-[52px] items-center gap-2.5 rounded-2xl bg-tinte px-4 text-white dark:bg-leaf">
              <span className="min-w-0 flex-1 truncate font-semibold">{customTitle}</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-mono text-[11px]">eigene</span>
            </div>
          </li>
        )}
        {sortedWishlist.map((option) => {
          const selected = option.id === chosenId;
          return (
            <li key={option.id} className="relative">
              <button
                type="button"
                aria-pressed={mode.kind === "swap" ? undefined : selected}
                aria-label={option.title}
                onClick={() => chooseIdea({ id: option.id }, false)}
                className={cn(
                  "tap flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl py-1.5 pl-4 pr-11 text-left",
                  selected ? "bg-tinte text-white dark:bg-leaf" : "bg-surface text-ink",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">{option.title}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 font-mono text-[11px]",
                    selected ? "bg-white/15" : option.matched ? "bg-rose text-partner-ink" : option.overBudget ? "bg-zitrone-soft text-tinte" : "bg-soft",
                  )}
                >
                  {option.matched ? "♥ match" : option.overBudget ? "⚠️ über Budget" : SIZE_LABEL[option.size].label.toLowerCase()}
                </span>
              </button>
              <button
                type="button"
                onClick={() => editIdea(option)}
                aria-label={`${option.title} bearbeiten`}
                className={cn("absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full", selected ? "text-white/80" : "text-muted")}
              >
                <MoreIcon width={18} height={18} />
              </button>
            </li>
          );
        })}
      </ul>
    );

  const ideaTools = (
    <div className="flex items-center justify-center gap-5 text-[13px] font-semibold">
      <SurpriseButton look="link" label={<><DiceIcon width={15} height={15} /> Zufall</>} ideaSize={filter.size} onChoose={(chosen) => chooseIdea(chosen)} />
      <button
        type="button"
        className="tap flex items-center gap-1.5 underline"
        onClick={() => {
          // A fresh sheet each time (no suggestions left over from before).
          setMoreKey((k) => k + 1);
          moreSheet.current?.open();
        }}
      >
        <MoreIcon width={15} height={15} /> Was anderes
      </button>
    </div>
  );

  const sheets = (
    <>
      <Sheet ref={moreSheet} title="Was anderes?">
        {mode.kind === "new" && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!customTitle.trim()) return;
              moreSheet.current?.close();
              chooseCustom();
            }}
          >
            <label htmlFor="custom-title" className="text-[13px] font-medium text-muted">
              Eure eigene Idee
            </label>
            <input id="custom-title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} maxLength={120} placeholder="z. B. Eis essen und Rhein gucken" className={inputClass} />
            {customTitle.trim() !== "" && (
              <>
                <label htmlFor="custom-location" className="text-[13px] font-medium text-muted">
                  Ort (optional)
                </label>
                <input id="custom-location" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} maxLength={120} placeholder="z. B. Rheinufer" className={inputClass} />
              </>
            )}
            <Button type="submit" size="sm" variant="secondary" disabled={!customTitle.trim()}>
              Weiter →
            </Button>
          </form>
        )}
        <MoreIdeas
          key={moreKey}
          events={mode.kind === "new" ? events : null}
          aiEnabled={aiEnabled}
          slot={aiSlot ? { startIso: aiSlot.startIso, endIso: aiSlot.endIso, label: `${aiSlot.dateLabel}, ${aiSlot.timeLabel}`, size: aiSlot.size } : null}
          onChoose={(chosen) => {
            moreSheet.current?.close();
            chooseIdea(chosen);
          }}
          onEventPlanned={() => setTimeout(() => router.replace("/plan"), 1000)}
        />
      </Sheet>

      <Sheet ref={editSheet} title="Idee bearbeiten" onClose={() => setEditing(null)}>
        {editing && (
          <IdeaForm
            key={editing.id}
            action={updateIdeaAction}
            idea={{ id: editing.id, title: editing.title, size: editing.size, note: editing.note ?? null, url: editing.url ?? null, costEur: editing.costEur, location: editing.location }}
            onSaved={() => editSheet.current?.close()}
            onDelete={async () => {
              editSheet.current?.close();
              hideIdea(editing.id);
              await archiveIdeaAction(editing.id);
            }}
          />
        )}
      </Sheet>

      {mode.kind === "swap" && (
        <Sheet ref={swapSheet} title="Date ändern?" onClose={() => setSwapping(null)}>
          {swapping && (
            <SwapConfirm
              next={mode.next}
              idea={swapping}
              onCancel={() => swapSheet.current?.close()}
              onDone={() => {
                swapSheet.current?.close();
                celebrate();
                router.replace("/plan");
              }}
            />
          )}
        </Sheet>
      )}
    </>
  );

  // The top row: back on the left, the three dots (Filter · was? · wann?) in the middle – where the Beet has its dots.
  const backHome = (
    <Link href="/plan" aria-label="Zurück" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
      <BackIcon width={20} height={20} />
    </Link>
  );
  const backTo = (to: "filter" | "idea", label: string) => (
    <button type="button" onClick={() => setStep(to)} aria-label={label} className="tap flex size-11 items-center justify-center rounded-full bg-surface">
      <BackIcon width={20} height={20} />
    </button>
  );
  const top = <TopRow back={backHome} meta={hoursLeft} />;
  const flowTop = (n: number, back: ReactNode) => <TopRow back={back} center={<StepDots step={n} of={3} />} meta={hoursLeft} />;

  // Swapping the idea of a planned date: only "was?" – the time stays.
  if (mode.kind === "swap") {
    return (
      <div className="animate-slide-in flex min-h-0 flex-1 flex-col gap-3">
        {top}
        {intro}
        <div className="flex items-baseline justify-between gap-2 pt-2">
          <h2 className="headline text-[40px]">was anderes?</h2>
          <span className="flex items-center gap-2">
            <FilterButton />
            <QuickAdd look="link" />
          </span>
        </div>
        <p className="-mt-1 text-sm text-muted">
          Statt „{mode.next.title}“ ({mode.next.when}) – tipp an, was ihr lieber machen wollt. Der Termin bleibt.
        </p>
        {ideaList}
        {ideaTools}
        {sheets}
      </div>
    );
  }

  const hiddenForm = (
    <form id="plan-form" action={formAction} className="contents">
        {slot && (
          <>
            <input type="hidden" name="start" value={slot.startIso} />
            <input type="hidden" name="end" value={slot.endIso} />
          </>
        )}
        <input type="hidden" name="size" value={size} />
        <input type="hidden" name="ideaId" value={idea?.id ?? ""} />
        {pick?.kind === "custom" && (
          <>
            <input type="hidden" name="customTitle" value={customTitle} />
            <input type="hidden" name="customLocation" value={customLocation} />
          </>
        )}
        {mode.kind === "reschedule" && (
          <>
            <input type="hidden" name="dateId" value={mode.date.dateId} />
            <input type="hidden" name="keepDetails" value="1" />
          </>
        )}
    </form>
  );

  // Step 1, "worauf lust?": the filter as big pills – all on "Egal", so "Weiter" works right away.
  if (step === "filter" && mode.kind === "new") {
    return (
      <div key="filter" className="animate-slide-in flex min-h-0 flex-1 flex-col gap-2.5">
        {flowTop(1, backHome)}
        {intro}
        <h2 className="headline pt-2 text-[40px]">worauf lust?</h2>
        <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pb-1">
          <FilterQuestions big />
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full shrink-0"
          onClick={() => {
            // "Kurz"/"Lang" in the filter is the length of the date too.
            if (filter.size) setSize(filter.size);
            setStep("idea");
          }}
        >
          Weiter
        </Button>
      </div>
    );
  }

  // Step 2, "was?": pick the idea, "Weiter" goes on.
  if (step === "idea" && mode.kind === "new") {
    return (
      <div key="idea" className="animate-slide-in flex min-h-0 flex-1 flex-col gap-2.5">
        {hiddenForm}
        {flowTop(2, backTo("filter", "Zurück zum Filter"))}
        {intro}
        <div className="flex items-baseline justify-between gap-2 pt-2">
          <h2 className="headline text-[40px]">was?</h2>
          <span className="flex items-center gap-2">
            <FilterButton />
            <QuickAdd look="link" />
          </span>
        </div>
        {ideaList}
        {ideaTools}
        <Button type="button" size="lg" className="w-full shrink-0" disabled={!title} onClick={toTimes}>
          Weiter
        </Button>
        {sheets}
      </div>
    );
  }

  // Step "wann?": the times, then "Gießen & senden".
  return (
    <div key="time" className="animate-slide-in flex min-h-0 flex-1 flex-col gap-2.5">
      {hiddenForm}
      {mode.kind === "new" ? flowTop(3, backTo("idea", "Andere Idee")) : flowTop(3, backHome)}
      {intro}

      <div className="flex items-end justify-between gap-3 pt-1.5">
        <h2 className="headline text-[40px]">wann?</h2>
        {sizeToggle}
      </div>
      {mode.kind === "reschedule" && (
        <p className="-mt-1 text-sm text-muted">
          {mode.date.keepSecret ? "🤫 Das ist eine Überraschung – du kannst nur die Zeit ändern, der Rest bleibt geheim." : `„${mode.date.title}“ bleibt, nur die Zeit ändert sich.`}
        </p>
      )}
      {slotsBlock}
      {pager}
      {searchScopeLink}
      {ok && ok.failedCalendars > 0 && (
        <p className="text-center text-xs text-muted">
          {ok.failedCalendars === 1 ? "Ein Kalender konnte" : `${ok.failedCalendars} Kalender konnten`} nicht gelesen werden – prüft die Auswahl in den Einstellungen.
        </p>
      )}
      <div className="flex-1" />
      {mode.kind === "new" && surpriseEnabled && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2.5 text-sm font-semibold">
            <input form="plan-form" type="checkbox" name="surprise" value="1" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} className="size-5 accent-ink" />
            🎁 Als Überraschung planen
            {surprise && <span className="font-normal text-muted">({partnerName} sieht nur die Zeit)</span>}
          </label>
          {surprise && (
            <>
              <label htmlFor="surprise-hint" className="sr-only">
                Hinweis für {partnerName} (optional)
              </label>
              <input form="plan-form" id="surprise-hint" name="surpriseHint" maxLength={120} placeholder={`Hinweis für ${partnerName}, z. B. Bequeme Schuhe`} className={cn(inputClass, "h-10")} />
            </>
          )}
        </div>
      )}

      {slots.length > 0 && (
        <div className="flex shrink-0 flex-col gap-3 rounded-[22px] bg-surface p-3.5">
          {state.status === "error" && (
            <p role="alert" className="rounded-xl bg-rose px-3 py-2 text-sm font-medium text-tinte">
              {state.message}
            </p>
          )}
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-5 w-[34px] shrink-0 -rotate-[24deg] rounded-[50%] bg-leaf-light" />
            <p data-plan-summary className="line-clamp-2 text-base font-bold leading-tight">
              {slot ? `${slot.weekday} ${slot.timeLabel.split(" – ")[0]}` : "Wähl eine Zeit"}
              {title ? ` · ${title}` : mode.kind === "new" ? " · und eine Idee" : ""}
            </p>
          </div>
          {mode.kind === "new" && (budgetLine || budgetWarning || (budget && budget.pot > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
              {budgetLine}
              {budgetWarning && <span className="rounded-full bg-zitrone-soft px-2.5 py-0.5 text-tinte">⚠️ {budgetWarning}</span>}
              {budget && budget.pot > 0 && (
                <label className="flex items-center gap-2">
                  <input form="plan-form" type="checkbox" name="fromPot" value="1" className="size-5 accent-ink" />
                  🎁 Aus dem Spartopf ({budget.pot} €)
                </label>
              )}
            </div>
          )}
          <Button form="plan-form" type="submit" variant={mode.kind === "reschedule" ? "primary" : "send"} size="lg" disabled={!ready || pending || leaving} className="w-full">
            {pending ? "Wird eingetragen …" : mode.kind === "reschedule" ? "Termin ändern" : `Gießen & an ${partnerName} senden`}
          </Button>
        </div>
      )}
      {sheets}
    </div>
  );
}

function NoSlots({ size }: { size: IdeaSize }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[22px] border-[1.5px] border-dashed border-line px-5 py-4 text-center">
      <h3 className="text-lg font-bold">Keine gemeinsame Lücke gefunden</h3>
      <p className="text-sm text-muted">
        {size === "large"
          ? "Für ein langes Date braucht ihr einen halben Tag am Stück. Vielleicht passt ein kurzes Date?"
          : "Eure Kalender sind gerade richtig voll."}{" "}
        Sucht auch danach, oder passt in den Einstellungen Zeitraum, Puffer und Zeitfenster an.
      </p>
    </div>
  );
}
