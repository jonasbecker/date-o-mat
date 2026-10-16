"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/button";
import { Info } from "@/components/info";
import { useCelebrate } from "@/components/celebration";
import { SIZE_LABEL, SizeChip } from "@/components/size-chip";
import type { SlotMood } from "@/core/slots";
import { FilteredEmpty, FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SurpriseButton } from "@/components/surprise-button";
import { SwapConfirm, type NextDateInfo } from "@/components/swap-confirm";
import { matchesIdeaFilter } from "@/core/filters";
import type { EventView } from "../events/event-list";
import { MoreIdeas } from "./more-ideas";
import { cn } from "@/lib/cn";
import { IDEA_SIZES, type IdeaSize } from "@/lib/domain";
import { budgetHint } from "@/core/budget";
import type { SlotView } from "@/lib/format";
import { saveDateAction, type SaveDateState } from "./actions";

const MOOD_LABEL: Record<SlotMood, string> = {
  friday_evening: "Freitagabend",
  evening: "Feierabend",
  weekend_morning: "Brunch-Zeit",
  weekend_afternoon: "Wochenende",
  weekend_evening: "Wochenendabend",
  weekend_day: "Wochenende",
  daytime: "Tagsüber",
};

export type IdeaOption = { id: string; title: string; size: IdeaSize; meta: string | null; costEur?: number | null };

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

const inputClass =
  "h-12 w-full rounded-2xl border-[2.5px] border-line bg-surface px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70 focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

export function PlanFlow({
  mode,
  small,
  large,
  ideas,
  untilLabel,
  partnerName,
  searchScopeLink,
  preselectIdeaId,
  preselectSize,
  aiEnabled = false,
  surpriseEnabled = false,
  events = null,
  budget = null,
  budgetBar,
}: {
  mode: FlowMode;
  small: SlotView[];
  large: SlotView[];
  ideas: IdeaOption[];
  untilLabel: string;
  partnerName: string;
  /** "Auch nach dem Rundenende suchen" – rendered by the server page. */
  searchScopeLink?: React.ReactNode;
  /** From "Date damit planen" / a match: start at the time with this idea. */
  preselectIdeaId?: string;
  /** "Großes Date planen" (special days): long ideas and dates. */
  preselectSize?: IdeaSize;
  /** Show "✨ Ideen von der KI" (Claude is configured). */
  aiEnabled?: boolean;
  /** "🎁 Als Überraschung planen" – an extra that shows up after the first date. */
  surpriseEnabled?: boolean;
  /** Events where both are free; null when no event sources are set up. */
  events?: EventView[] | null;
  /** Month budget left and savings pot (null = no budget set). */
  budget?: { left: number; pot: number } | null;
  /** The month's budget bar – shown next to the times, not on the start. */
  budgetBar?: React.ReactNode;
}) {
  const router = useRouter();
  const preselected = mode.kind === "new" && preselectIdeaId ? ideas.find((i) => i.id === preselectIdeaId) : undefined;
  const [step, setStep] = useState<"idea" | "time">(mode.kind === "reschedule" || preselected ? "time" : "idea");
  const [pick, setPick] = useState<IdeaPick | null>(preselected ? { kind: "idea", id: preselected.id } : null);
  const [size, setSize] = useState<IdeaSize>(mode.kind === "reschedule" ? mode.date.size : (preselected?.size ?? preselectSize ?? "small"));
  const slots = size === "small" ? small : large;
  const [slotKey, setSlotKey] = useState<string | null>(slots[0]?.key ?? null);
  const moreSheet = useRef<SheetHandle>(null);
  // The flow sits below the state of the round: each step scrolls itself into view.
  const anchor = useRef<HTMLSpanElement>(null);
  const firstStep = useRef(step);
  useEffect(() => {
    if (step === firstStep.current && step === "idea") return;
    firstStep.current = "idea";
    anchor.current?.scrollIntoView({ block: "start" });
  }, [step]);
  const swapSheet = useRef<SheetHandle>(null);
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
    setSlotKey((next === "small" ? small : large)[0]?.key ?? null);
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
    selectSize(chosen.size ?? known?.size ?? filter.size ?? size);
    setStep("time");
  }

  function chooseCustom() {
    setPick({ kind: "custom" });
    selectSize(filter.size ?? "small");
    setStep("time");
  }

  const slot = slots.find((s) => s.key === slotKey);
  const idea = pick?.kind === "idea" ? (ideas.find((i) => i.id === pick.id) ?? (pick.title ? { id: pick.id, title: pick.title, meta: null, costEur: null } : undefined)) : undefined;
  const title = mode.kind === "reschedule" ? mode.date.title : pick?.kind === "custom" ? customTitle.trim() : (idea?.title ?? "");
  const ready = Boolean(slot && title);
  const pickedCost = idea && "costEur" in idea ? (idea.costEur ?? null) : null;
  const budgetWarning = budget ? budgetHint(pickedCost, budget.left) : null;
  // Swapping: the date's own idea is not an alternative to itself.
  const wishlist = ideas.filter((i) => matchesIdeaFilter({ size: i.size, costEur: i.costEur }, filter) && !(mode.kind === "swap" && i.id === mode.next.ideaId));

  // The AI plans for your next free time (weather, length) – the Top-Tipp of the filtered length.
  const aiSlot = (filter.size === "large" ? large : small)[0];

  // "⚡ Schnell planen": top short slot + the short idea that has waited longest.
  const quickSlot = small[0];
  const quickIdea = ideas.find((i) => i.size === "small");
  const showQuick = mode.kind === "new" && quickSlot && quickIdea;

  if (step === "idea") {
    return (
      <div className="flex flex-col gap-4">
        <span ref={anchor} className="-mb-4 block scroll-mt-4" />
        {showQuick && (
          <form action={formAction} className="sticker flex flex-col gap-2.5 rounded-[22px] bg-zitrone-soft p-4 text-tinte">
            <input type="hidden" name="start" value={quickSlot.startIso} />
            <input type="hidden" name="end" value={quickSlot.endIso} />
            <input type="hidden" name="size" value="small" />
            <input type="hidden" name="ideaId" value={quickIdea.id} />
            <p className="text-[13px] font-extrabold uppercase tracking-wide">⚡ Schnell planen</p>
            <p className="font-bold">
              <span className="font-display text-lg font-semibold">{quickIdea.title}</span>
              <br />
              {quickSlot.dateLabel}, {quickSlot.timeLabel}
            </p>
            <Button type="submit" size="sm" className="self-start" disabled={pending || leaving}>
              So festlegen 🎉
            </Button>
            {state.status === "error" && (
              <p role="alert" className="text-sm font-bold">
                {state.message}
              </p>
            )}
          </form>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">{mode.kind === "swap" ? "Lieber was anderes?" : "Schritt 1 von 2"}</p>
            <h2 className="text-[24px] font-semibold leading-tight">Was wollt ihr machen?</h2>
          </div>
          <FilterButton />
        </div>
        {mode.kind === "swap" && (
          <p className="-mt-2 font-bold text-muted">
            Statt „{mode.next.title}“ ({mode.next.when}) – tipp an, was ihr lieber machen wollt. Der Termin bleibt.
          </p>
        )}

        {ideas.length === 0 ? (
          <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-4 font-bold text-muted">
            Eure Wunschliste ist noch leer. Holt euch unten etwas Neues – oder schreibt eure eigene Idee auf.
          </p>
        ) : wishlist.length === 0 ? (
          <FilteredEmpty what="Ideen" />
        ) : (
          <ul className="flex flex-col gap-2.5" aria-label="Eure Wunschliste">
            {wishlist.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => chooseIdea({ id: option.id })}
                  className="press flex w-full items-center gap-3 rounded-[20px] border-[2.5px] border-line bg-surface p-3 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-display text-lg font-semibold leading-snug">{option.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-extrabold text-muted">
                      <SizeChip size={option.size} />
                      {option.meta}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-xl font-bold">
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <SurpriseButton size="sm" label="🎲 Zufall" ideaSize={filter.size} onChoose={(chosen) => chooseIdea(chosen)} />
          <Button variant="secondary" size="sm" className="w-full" onClick={() => moreSheet.current?.open()}>
            Was anderes …
          </Button>
        </div>
        <Link href="/ideas/entdecken" className={buttonClass("secondary", "sm", "w-full")}>
          💞 Neue Ideen swipen
        </Link>

        {mode.kind === "new" && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (customTitle.trim()) chooseCustom();
            }}
          >
            <label htmlFor="custom-title" className="text-[13px] font-extrabold text-muted">
              Oder eure eigene Idee
            </label>
            <div className="flex gap-2">
              <input
                id="custom-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                maxLength={120}
                placeholder="z. B. Eis essen und Rhein gucken"
                className={inputClass}
              />
              <Button type="submit" size="sm" variant="secondary" className="h-12 shrink-0" disabled={!customTitle.trim()}>
                Weiter →
              </Button>
            </div>
          </form>
        )}

        <Sheet ref={moreSheet} title="Was anderes?">
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
    <form action={formAction} className="flex flex-col gap-4 pb-48">
      <span ref={anchor} className="-mb-4 block scroll-mt-4" />
      {slot && (
        <>
          <input type="hidden" name="start" value={slot.startIso} />
          <input type="hidden" name="end" value={slot.endIso} />
        </>
      )}
      <input type="hidden" name="size" value={size} />
      <input type="hidden" name="ideaId" value={idea?.id ?? ""} />
      {pick?.kind === "custom" && <input type="hidden" name="customTitle" value={customTitle} />}
      {mode.kind === "reschedule" && (
        <>
          <input type="hidden" name="dateId" value={mode.date.dateId} />
          <input type="hidden" name="keepDetails" value="1" />
        </>
      )}

      {mode.kind === "reschedule" ? (
        <div>
          <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Termin ändern</p>
          <h2 className="text-[24px] font-semibold leading-tight">Wann passt es besser?</h2>
          <p className="mt-1 font-bold text-muted">
            {mode.date.keepSecret ? "🤫 Das ist eine Überraschung – du kannst nur die Zeit ändern, der Rest bleibt geheim." : `„${mode.date.title}“ bleibt, nur die Zeit ändert sich.`}
          </p>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => setStep("idea")} className="self-start text-sm font-extrabold text-muted underline">
            ← Andere Idee
          </button>
          <div className="flex flex-col gap-1 rounded-[20px] border-[2.5px] border-line bg-surface px-4 py-3">
            <span className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Ihr macht</span>
            <span className="font-display text-xl font-semibold leading-snug">{title}</span>
            {idea?.meta && <span className="text-xs font-extrabold text-muted">{idea.meta}</span>}
          </div>
          {pick?.kind === "custom" && (
            <div className="flex flex-col gap-2">
              <label htmlFor="custom-location" className="text-[13px] font-extrabold text-muted">
                Ort (optional)
              </label>
              <input
                id="custom-location"
                name="customLocation"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                maxLength={120}
                placeholder="z. B. Rheinufer"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Schritt 2 von 2</p>
            <h2 className="text-[24px] font-semibold leading-tight">Wann?</h2>
          </div>
        </>
      )}

      {budgetBar}
      <div className="-mb-2 flex items-center gap-2">
        <h3 className="text-[17px] font-semibold">Wie lang?</h3>
        <Info term="dauer" />
      </div>
      <div role="group" aria-label="Wie lang soll das Date sein?" className="grid grid-cols-2 gap-1.5 rounded-[22px] border-[2.5px] border-line bg-surface p-1.5">
        {IDEA_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={size === option}
            onClick={() => selectSize(option)}
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 py-2",
              size === option ? cn("border-line text-tinte", option === "small" ? "bg-zitrone" : "bg-lavendel") : "border-transparent text-muted",
            )}
          >
            <span className={cn("font-display text-lg font-semibold", size !== option && "text-ink")}>
              {SIZE_LABEL[option].emoji} {SIZE_LABEL[option].label}
            </span>
            <span className="text-xs font-extrabold">{SIZE_LABEL[option].hint}</span>
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between">
        <h3 className="text-[17px] font-semibold">Freie Zeiten</h3>
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-muted">
          ihr seid beide frei <Info term="frei" />
        </span>
      </div>

      {slots.length === 0 ? (
        <NoSlots size={size} />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {slots.map((option, index) => {
            const selected = option.key === slotKey;
            return (
              <li key={option.key} className="animate-pop-in">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSlotKey(option.key)}
                  className={cn(
                    "flex w-full items-center gap-3.5 rounded-[20px] border-[2.5px] border-line p-2.5 pr-3.5 text-left transition-shadow",
                    selected ? "bg-himbeere-soft text-tinte shadow-[4px_4px_0_var(--line)]" : "bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] border-2 border-line leading-none",
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
                        <span className="rounded-full border-[1.5px] border-line bg-zitrone px-2 py-px text-tinte">★ Top-Tipp</span>
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
      <p className="text-center text-[13px] font-bold text-muted">Gesucht bis {untilLabel}</p>
      {searchScopeLink}

      {mode.kind === "new" && surpriseEnabled && (
        <div className="flex flex-col gap-2 rounded-[20px] border-2 border-dashed border-line p-3">
          <label className="flex items-center gap-2.5 font-extrabold">
            <input type="checkbox" name="surprise" value="1" checked={surprise} onChange={(e) => setSurprise(e.target.checked)} className="size-5 accent-himbeere" />
            🎁 Als Überraschung planen
          </label>
          {surprise && (
            <>
              <p className="text-sm font-semibold text-muted">
                {partnerName} sieht bis zum Tag selbst nur die Zeit (auch im Google-Kalender) – und deinen Hinweis.
              </p>
              <label htmlFor="surprise-hint" className="text-[13px] font-extrabold text-muted">
                Hinweis für {partnerName} (optional)
              </label>
              <input id="surprise-hint" name="surpriseHint" maxLength={120} placeholder="z. B. Bequeme Schuhe, nichts vorher essen" className={inputClass} />
            </>
          )}
        </div>
      )}

      {slots.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t-[2.5px] border-line bg-surface px-5 pb-[max(env(safe-area-inset-bottom),14px)] pt-3">
          <div className="mx-auto flex max-w-md flex-col gap-2.5">
            {state.status === "error" && (
              <p role="alert" className="rounded-xl bg-himbeere-soft px-3 py-2 text-sm font-bold text-tinte">
                {state.message}
              </p>
            )}
            <p className="truncate text-sm font-bold">
              {slot ? `${slot.dateLabel} · ${slot.timeLabel}` : "Wähl eine Zeit"} {title && `· ${title}`}
            </p>
            {mode.kind === "new" && budget && (budgetWarning || budget.pot > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm font-bold">
                {budgetWarning && <span className="rounded-full bg-zitrone px-2.5 py-0.5 text-tinte">⚠️ {budgetWarning}</span>}
                {budget.pot > 0 && (
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
        </div>
      )}
    </form>
  );
}

function NoSlots({ size }: { size: IdeaSize }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-8 text-center">
      <span className="text-4xl" aria-hidden="true">
        🫠
      </span>
      <h3 className="text-xl font-bold">Keine gemeinsame Lücke gefunden</h3>
      <p className="font-semibold text-muted">
        {size === "large"
          ? "Für ein langes Date braucht ihr einen halben Tag am Stück. Vielleicht passt ein kurzes Date?"
          : "Eure Kalender sind gerade richtig voll."}{" "}
        Sucht auch nach dem Rundenende, oder passt in den Einstellungen Zeitraum, Puffer und Zeitfenster an.
      </p>
    </div>
  );
}
