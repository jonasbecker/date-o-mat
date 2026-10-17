"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { SIZE_LABEL } from "@/components/size-chip";
import { orderSlots, type SlotMood } from "@/core/slots";
import { FilteredEmpty, FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SurpriseButton } from "@/components/surprise-button";
import { SwapConfirm, type NextDateInfo } from "@/components/swap-confirm";
import { StepDots } from "@/components/step-dots";
import { QuickAdd } from "@/components/quick-add";
import { IdeaForm } from "@/components/idea-form";
import { archiveIdeaAction, updateIdeaAction } from "../ideas/actions";
import { Mascot } from "@/components/mascot";
import { DiceIcon, MoreIcon } from "@/components/icons";
import { IdeaCard, ideaFacts, type IdeaCardView } from "@/components/idea-card";
import { matchesIdeaFilter } from "@/core/filters";
import type { EventView } from "../events/event-list";
import { MoreIdeas } from "./more-ideas";
import { cn } from "@/lib/cn";
import { IDEA_SIZES, type IdeaSize } from "@/lib/domain";
import { budgetHint } from "@/core/budget";
import type { SlotView } from "@/lib/format";
import { freeTimesAction, saveDateAction, type FreeTimes, type SaveDateState } from "./actions";

const MOOD_LABEL: Record<SlotMood, string> = {
  friday_evening: "Freitagabend",
  evening: "Feierabend",
  weekend_morning: "Brunch-Zeit",
  weekend_afternoon: "Wochenende",
  weekend_evening: "Wochenendabend",
  weekend_day: "Wochenende",
  daytime: "Tagsüber",
};

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
  "h-12 w-full rounded-2xl border-[2.5px] border-line bg-surface px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70 focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

/** Free times older than this are fetched again when step 2 opens. */
const TIMES_FRESH_MS = 60_000;

function isStale(loadedAt: number): boolean {
  return Date.now() - loadedAt > TIMES_FRESH_MS;
}

export function PlanFlow({
  mode,
  later = false,
  ideas,
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
  /** What sits above step 1 (the state of the round) – the times get the whole screen. */
  intro?: ReactNode;
}) {
  const router = useRouter();
  const preselected = mode.kind === "new" && preselectIdeaId ? ideas.find((i) => i.id === preselectIdeaId) : undefined;
  const [step, setStep] = useState<"idea" | "time">(mode.kind === "reschedule" || preselected ? "time" : "idea");
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
  const small = ok ? orderSlots(ok.small) : NO_SLOTS;
  const large = ok ? orderSlots(ok.large) : NO_SLOTS;
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

  /** Step 1 → 2 (or, with a date planned, the question whether to swap). */
  function chooseIdea(chosen: { id: string; title?: string; size?: IdeaSize }) {
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
    toTimes();
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
  const facts = idea ? ideaFacts(idea) : customLocation && `📍 ${customLocation}`;
  const budgetWarning = budget ? budgetHint(pickedCost, budget.left) : null;
  // Swapping: the date's own idea is not an alternative to itself.
  const wishlist = ideas.filter((i) => matchesIdeaFilter({ size: i.size, costEur: i.costEur }, filter) && !(mode.kind === "swap" && i.id === mode.next.ideaId));
  const pageCount = Math.max(1, Math.ceil(slots.length / SLOTS_PER_PAGE));
  const shownSlots = slots.slice(slotPage * SLOTS_PER_PAGE, (slotPage + 1) * SLOTS_PER_PAGE);

  // The AI plans for your next free time (weather, length) – the Top-Tipp of the filtered length.
  const aiSlot = (filter.size === "large" ? large : small)[0];

  if (step === "idea") {
    return (
      <div key="idea" className="animate-slide-in flex min-h-0 flex-1 flex-col gap-3">
        {intro}

        {/* The wishlist itself: add, edit and choose all happen here. */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            {mode.kind === "swap" ? <p className="text-[12px] font-extrabold text-muted">Lieber was anderes?</p> : <StepDots step={1} of={2} />}
            <span className="flex items-center gap-2">
              <FilterButton />
              <QuickAdd />
            </span>
          </div>
          <h2 className="text-[22px] font-semibold leading-tight">Was wollt ihr machen?</h2>
        </div>
        {mode.kind === "swap" && (
          <p className="-mt-1 text-sm font-bold text-muted">
            Statt „{mode.next.title}“ ({mode.next.when}) – tipp an, was ihr lieber machen wollt. Der Termin bleibt.
          </p>
        )}

        {/* The wishlist is the one part that scrolls. */}
        {ideas.length === 0 ? (
          <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-4 font-bold text-muted">
            Eure Wunschliste ist noch leer. Holt euch unten etwas Neues – oder schreibt eure eigene Idee auf.
          </p>
        ) : wishlist.length === 0 ? (
          <FilteredEmpty what="Ideen" />
        ) : (
          <ul data-scroll className="-mx-1 flex min-h-[7.5rem] flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 pb-1" aria-label="Eure Wunschliste">
            {wishlist.map((option) => (
              <li key={option.id}>
                <IdeaCard idea={option} onOpen={() => chooseIdea({ id: option.id })} onMore={() => editIdea(option)} />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <SurpriseButton size="sm" label={<><DiceIcon width={17} height={17} /> Zufall</>} ideaSize={filter.size} className="gap-1.5 whitespace-nowrap px-1.5 text-[14px]" onChoose={(chosen) => chooseIdea(chosen)} />
          <Button variant="secondary" size="sm" className="w-full gap-1.5 whitespace-nowrap px-1.5 text-[14px]" onClick={() => moreSheet.current?.open()}>
            <MoreIcon width={17} height={17} /> Was anderes
          </Button>
        </div>

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
              <label htmlFor="custom-title" className="text-[13px] font-extrabold text-muted">
                Eure eigene Idee
              </label>
              <input
                id="custom-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={120}
                placeholder="z. B. Eis essen und Rhein gucken"
                className={inputClass}
              />
              {customTitle.trim() !== "" && (
                <>
                  <label htmlFor="custom-location" className="text-[13px] font-extrabold text-muted">
                    Ort (optional)
                  </label>
                  <input
                    id="custom-location"
                    value={customLocation}
                    onChange={(e) => setCustomLocation(e.target.value)}
                    maxLength={120}
                    placeholder="z. B. Rheinufer"
                    className={inputClass}
                  />
                </>
              )}
              <Button type="submit" size="sm" variant="secondary" disabled={!customTitle.trim()}>
                Weiter →
              </Button>
            </form>
          )}
          <MoreIdeas
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
                await archiveIdeaAction(editing.id);
                editSheet.current?.close();
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
      </div>
    );
  }

  return (
    <form key="time" action={formAction} className="animate-slide-in flex min-h-0 flex-1 flex-col gap-3">
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

      {mode.kind === "reschedule" ? (
        <div>
          <p className="text-[12px] font-extrabold text-muted">Termin ändern</p>
          <h2 className="text-[22px] font-semibold leading-tight">Wann passt es besser?</h2>
          <p className="text-sm font-bold text-muted">
            {mode.date.keepSecret ? "🤫 Das ist eine Überraschung – du kannst nur die Zeit ändern, der Rest bleibt geheim." : `„${mode.date.title}“ bleibt, nur die Zeit ändert sich.`}
          </p>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => setStep("idea")} className="self-start text-sm font-extrabold text-muted underline">
            ← Andere Idee
          </button>
          <div className="flex flex-col rounded-[18px] border-[2.5px] border-line bg-surface px-4 py-2.5">
            <span className="text-[12px] font-extrabold text-muted">Ihr macht</span>
            <span className="font-display text-lg font-semibold leading-snug">{title}</span>
            {facts && <span className="text-xs font-extrabold text-muted">{facts}</span>}
          </div>
        </>
      )}

      <div className="flex items-end justify-between gap-3">
        <div>
          {mode.kind !== "reschedule" && <StepDots step={2} of={2} />}
          <h2 className="text-[22px] font-semibold leading-tight">Wann?</h2>
        </div>
        <div role="group" aria-label="Wie lang soll das Date sein?" className="flex gap-1 rounded-full border-2 border-line bg-surface p-1">
          {IDEA_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={size === option}
              onClick={() => selectSize(option)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-extrabold",
                size === option ? "bg-ink text-bg" : "text-muted",
              )}
            >
              {SIZE_LABEL[option].emoji} {SIZE_LABEL[option].label}
            </button>
          ))}
        </div>
      </div>

      {!times || (loadingTimes && !ok) ? (
        <div className="flex flex-col items-center gap-2 py-6" aria-busy="true" aria-label="Sucht freie Zeiten …">
          <Mascot id="times" size={72} busy />
          <p className="text-sm font-extrabold text-muted">Der Date-O-Mat kurbelt … eure freien Zeiten kommen gleich.</p>
        </div>
      ) : times.result.status === "google_error" ? (
        <p role="alert" className="rounded-[18px] border-2 border-line bg-himbeere-soft px-4 py-3 font-bold text-tinte">
          Google Kalender antwortet gerade nicht.{" "}
          <button type="button" onClick={loadTimes} className="underline">
            Nochmal versuchen
          </button>
        </p>
      ) : times.result.status === "not_connected" ? (
        <p role="alert" className="rounded-[18px] border-2 border-line bg-zitrone-soft px-4 py-3 font-bold text-tinte">
          Ein Kalender ist nicht mehr verbunden.{" "}
          <Link href="/settings?t=kalender" className="underline">
            In den Einstellungen verbinden
          </Link>
        </p>
      ) : slots.length === 0 ? (
        <NoSlots size={size} />
      ) : (
        <ol className="flex flex-col gap-2">
          {shownSlots.map((option, i) => {
            const index = slotPage * SLOTS_PER_PAGE + i;
            const selected = option.key === slotKey;
            return (
              <li key={option.key} className="animate-pop-in">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSlotKey(option.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[18px] border-[2.5px] border-line p-2 pr-3 text-left transition-shadow",
                    selected ? "bg-himbeere-soft text-tinte shadow-[4px_4px_0_var(--line)]" : "bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[48px] shrink-0 flex-col items-center justify-center rounded-[13px] border-2 border-line leading-none",
                      selected ? "bg-himbeere" : "bg-bg",
                    )}
                  >
                    <span className="text-xs font-extrabold">{option.weekday}</span>
                    <span className="font-display text-[22px] font-bold">{option.day}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-display text-lg font-semibold">{option.timeLabel}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                      {index === 0 && (
                        <span className="rounded-full border-[1.5px] border-line bg-bg px-2 py-px text-ink">★ Top-Tipp</span>
                      )}
                      <span className={selected ? "" : "text-muted"}>
                        {option.dateLabel} · {MOOD_LABEL[option.mood]}
                        {option.size === "large" && ` · ${option.durationLabel}`}
                      </span>
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border-[2.5px]",
                      selected ? "border-line bg-himbeere text-tinte" : "border-muted/50",
                    )}
                  >
                    {selected && "✓"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex items-center justify-between gap-2 text-[13px] font-extrabold">
        <button type="button" disabled={slotPage === 0} onClick={() => setSlotPage((p) => p - 1)} className={cn("underline", slotPage === 0 && "invisible")}>
          ← Frühere
        </button>
        <span className="text-muted">{ok && `Gesucht bis ${ok.untilLabel}`}</span>
        <button type="button" disabled={slotPage >= pageCount - 1} onClick={() => setSlotPage((p) => p + 1)} className={cn("underline", slotPage >= pageCount - 1 && "invisible")}>
          Weitere Zeiten →
        </button>
      </div>
      {searchScopeLink}
      {ok && ok.failedCalendars > 0 && (
        <p className="text-center text-xs font-bold text-muted">
          {ok.failedCalendars === 1 ? "Ein Kalender konnte" : `${ok.failedCalendars} Kalender konnten`} nicht gelesen werden – prüft die Auswahl in den Einstellungen.
        </p>
      )}

      {mode.kind === "new" && surpriseEnabled && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2.5 text-sm font-extrabold">
            <input type="checkbox" name="surprise" value="1" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} className="size-5 accent-himbeere" />
            🎁 Als Überraschung planen
            {surprise && <span className="font-semibold text-muted">({partnerName} sieht nur die Zeit)</span>}
          </label>
          {surprise && (
            <>
              <label htmlFor="surprise-hint" className="sr-only">
                Hinweis für {partnerName} (optional)
              </label>
              <input id="surprise-hint" name="surpriseHint" maxLength={120} placeholder={`Hinweis für ${partnerName}, z. B. Bequeme Schuhe`} className={cn(inputClass, "h-10")} />
            </>
          )}
        </div>
      )}

      {slots.length > 0 && (
        <div className="-mx-5 mt-auto flex flex-col gap-2 border-t-[2.5px] border-line bg-surface px-5 pb-1 pt-3">
          {state.status === "error" && (
            <p role="alert" className="rounded-xl bg-himbeere-soft px-3 py-2 text-sm font-bold text-tinte">
              {state.message}
            </p>
          )}
          <p className="truncate text-sm font-bold">
            {slot ? `${slot.dateLabel} · ${slot.timeLabel}` : "Wähl eine Zeit"} {title && `· ${title}`}
          </p>
          {mode.kind === "new" && (budgetLine || budgetWarning || (budget && budget.pot > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-bold">
              {budgetLine}
              {budgetWarning && <span className="rounded-full bg-zitrone px-2.5 py-0.5 text-tinte">⚠️ {budgetWarning}</span>}
              {budget && budget.pot > 0 && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="fromPot" value="1" className="size-5 accent-himbeere" />
                  🎁 Aus dem Spartopf ({budget.pot} €)
                </label>
              )}
            </div>
          )}
          <Button type="submit" disabled={!ready || pending || leaving} className="h-14 w-full text-xl">
            {pending ? "Wird eingetragen …" : mode.kind === "reschedule" ? "Termin ändern" : "Date festlegen 🎉"}
          </Button>
          <p className="text-center text-xs font-bold text-muted">
            {mode.kind === "reschedule"
              ? `${partnerName} bekommt die Änderung über Google Kalender.`
              : `Du wirst Organisator:in, ${partnerName} bekommt die Kalender-Einladung.`}
          </p>
        </div>
      )}
    </form>
  );
}

function NoSlots({ size }: { size: IdeaSize }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-8 text-center">
      <Mascot id="no-slots" size={56} />
      <h3 className="text-xl font-bold">Keine gemeinsame Lücke gefunden</h3>
      <p className="font-semibold text-muted">
        {size === "large"
          ? "Für ein langes Date braucht ihr einen halben Tag am Stück. Vielleicht passt ein kurzes Date?"
          : "Eure Kalender sind gerade richtig voll."}{" "}
        Sucht auch danach, oder passt in den Einstellungen Zeitraum, Puffer und Zeitfenster an.
      </p>
    </div>
  );
}
