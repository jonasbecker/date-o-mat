"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/button";
import { Info } from "@/components/info";
import { useCelebrate } from "@/components/celebration";
import { SIZE_LABEL } from "@/components/size-chip";
import type { SlotMood } from "@/core/slots";
import { FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SurpriseButton } from "@/components/surprise-button";
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

/** `keepSecret`: someone else's surprise – only the time can be changed. */
export type RescheduleInfo = { dateId: string; size: IdeaSize; ideaId: string | null; title: string; location: string | null; keepSecret?: boolean };

/** `title` is known right away for ideas that were just put on the wishlist (before the page refreshed). */
type IdeaPick = { kind: "idea"; id: string; title?: string } | { kind: "custom" };

const inputClass =
  "h-12 w-full rounded-2xl border-[2.5px] border-line bg-surface px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70 focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

export function PlanForm({
  small,
  large,
  ideas,
  untilLabel,
  partnerName,
  reschedule,
  searchScopeLink,
  preselectIdeaId,
  preselectSize,
  aiEnabled = false,
  surpriseEnabled = false,
  events = null,
  budget = null,
}: {
  small: SlotView[];
  large: SlotView[];
  ideas: IdeaOption[];
  untilLabel: string;
  partnerName: string;
  reschedule?: RescheduleInfo;
  /** "Auch nach dem Rundenende suchen" – rendered by the server page. */
  searchScopeLink?: React.ReactNode;
  /** From "Überrasch uns" / "Damit planen": start with this idea selected. */
  preselectIdeaId?: string;
  /** "Großes Date planen" (special days): start with long dates. */
  preselectSize?: IdeaSize;
  /** Show "✨ Ideen von der KI" (Claude is configured). */
  aiEnabled?: boolean;
  /** "🎁 Als Überraschung planen" – an extra that shows up after the first date. */
  surpriseEnabled?: boolean;
  /** Events where both are free; null when no event sources are set up. */
  events?: EventView[] | null;
  /** Month budget left and savings pot (null = no budget set). */
  budget?: { left: number; pot: number } | null;
}) {
  const router = useRouter();
  const preselected = !reschedule && preselectIdeaId ? ideas.find((i) => i.id === preselectIdeaId) : undefined;
  const [size, setSize] = useState<IdeaSize>(reschedule?.size ?? preselected?.size ?? preselectSize ?? "small");
  const slots = size === "small" ? small : large;
  const [slotKey, setSlotKey] = useState<string | null>(slots[0]?.key ?? null);
  const firstIdea = (s: IdeaSize): IdeaPick => {
    const idea = ideas.find((i) => i.size === s);
    return idea ? { kind: "idea", id: idea.id } : { kind: "custom" };
  };
  const [pick, setPick] = useState<IdeaPick>(() =>
    reschedule
      ? reschedule.ideaId
        ? { kind: "idea", id: reschedule.ideaId }
        : { kind: "custom" }
      : preselected
        ? { kind: "idea", id: preselected.id }
        : firstIdea(size),
  );
  const moreSheet = useRef<SheetHandle>(null);
  const [filter] = useIdeaFilter();
  const [customTitle, setCustomTitle] = useState(reschedule && !reschedule.ideaId ? reschedule.title : "");
  const [customLocation, setCustomLocation] = useState(reschedule?.location ?? "");
  const celebrate = useCelebrate();
  const [leaving, setLeaving] = useState(false);
  const [surprise, setSurprise] = useState(false);

  const [state, formAction, pending] = useActionState<SaveDateState, FormData>(async (prev, formData) => {
    const result = await saveDateAction(prev, formData);
    if (result.status === "saved") {
      setLeaving(true);
      celebrate();
      setTimeout(() => router.push("/"), 1000);
    }
    return result;
  }, { status: "idle" });

  function chooseIdea(chosen: { id: string; title?: string }) {
    setPick({ kind: "idea", ...chosen });
    setCustomTitle("");
  }

  function chooseSize(next: IdeaSize) {
    setSize(next);
    setSlotKey((next === "small" ? small : large)[0]?.key ?? null);
    if (pick.kind === "custom" ? false : ideas.find((i) => i.id === pick.id)?.size !== next) setPick(firstIdea(next));
  }

  const slot = slots.find((s) => s.key === slotKey);
  const sizeIdeas = ideas.filter((i) => i.size === size);
  const idea = pick.kind === "idea" ? (ideas.find((i) => i.id === pick.id) ?? (pick.title ? { id: pick.id, title: pick.title } : undefined)) : undefined;
  const title = pick.kind === "custom" ? customTitle.trim() : (idea?.title ?? "");
  // The length is chosen above; the filter adds budget and inside/outside.
  const wishlist = sizeIdeas.filter((i) => matchesIdeaFilter({ costEur: i.costEur }, { ...filter, size: undefined }));
  const ready = Boolean(slot && title);
  const pickedCost = pick.kind === "idea" ? (ideas.find((i) => i.id === pick.id)?.costEur ?? null) : null;
  const budgetWarning = budget ? budgetHint(pickedCost, budget.left) : null;

  // "⚡ Schnell planen": top short slot + the short idea that has waited longest.
  const quickSlot = small[0];
  const quickIdea = ideas.find((i) => i.size === "small");
  const showQuick = !reschedule && !preselected && quickSlot && quickIdea;

  return (
    <>
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
          <p className="text-xs font-bold">Oder unten selbst Dauer, Termin und Idee aussuchen.</p>
        </form>
      )}
      <form action={formAction} className="flex flex-col gap-4 pb-40">
        {slot && (
          <>
              <input type="hidden" name="start" value={slot.startIso} />
              <input type="hidden" name="end" value={slot.endIso} />
          </>
        )}
        <input type="hidden" name="size" value={size} />
        <input type="hidden" name="ideaId" value={idea?.id ?? ""} />
        {reschedule && <input type="hidden" name="dateId" value={reschedule.dateId} />}

        <div className="-mb-2 flex items-center gap-2">
        <h2 className="text-[21px] font-semibold">Wie lang?</h2>
        <Info term="dauer" />
      </div>
      <div role="group" aria-label="Wie lang soll das Date sein?" className="grid grid-cols-2 gap-1.5 rounded-[22px] border-[2.5px] border-line bg-surface p-1.5">
          {IDEA_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={size === option}
              onClick={() => chooseSize(option)}
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
          <h2 className="text-[21px] font-semibold">Wann?</h2>
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

        {reschedule?.keepSecret ? (
          <p className="rounded-2xl border-2 border-line bg-himbeere-soft px-3.5 py-2.5 font-bold text-tinte">
            🤫 Das ist eine Überraschung – du kannst nur die Zeit ändern, der Rest bleibt geheim.
            <input type="hidden" name="keepDetails" value="1" />
          </p>
        ) : (
          <>
        <h2 className="text-[21px] font-semibold">Was machen wir?</h2>

        <p className={cn("rounded-2xl border-2 px-3.5 py-2.5 font-bold", title ? "border-line bg-surface" : "border-dashed border-line text-muted")}>
          {title ? (
            <>
              <span className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Ausgewählt</span>
              <span className="block font-display text-lg font-semibold leading-snug text-ink">{title}</span>
            </>
          ) : (
            "Noch keine Idee ausgewählt – such dir unten eine aus."
          )}
        </p>

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Von eurer Wunschliste</h3>
          <FilterButton />
        </div>
        {wishlist.length > 0 ? (
          <ul className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-2">
            {wishlist.map((option) => {
              const selected = pick.kind === "idea" && pick.id === option.id;
              return (
                <li key={option.id} className="snap-start">
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseIdea({ id: option.id })}
                    className={cn(
                      "flex h-full w-[168px] flex-col gap-2 rounded-[20px] border-[2.5px] border-line p-3 text-left",
                      selected ? (size === "small" ? "bg-zitrone" : "bg-lavendel") + " text-tinte shadow-[4px_4px_0_var(--line)]" : "bg-surface",
                    )}
                  >
                    <span className="font-display text-base font-semibold leading-tight">{option.title}</span>
                    {option.meta && <span className="text-xs font-extrabold opacity-80">{option.meta}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm font-bold text-muted">
            {sizeIdeas.length > 0
              ? "Auf der Wunschliste passt gerade nichts zum Filter."
              : `Keine ${SIZE_LABEL[size].label.toLowerCase()}en Ideen auf eurer Wunschliste.`}{" "}
            Tipp auf „Was anderes …“ oder schreib unten eure eigene Idee auf.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <SurpriseButton size="sm" label="🎲 Zufall" ideaSize={size} onChoose={(chosen) => chooseIdea(chosen)} />
          <Button variant="secondary" size="sm" className="w-full" onClick={() => moreSheet.current?.open()}>
            Was anderes …
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="custom-title" className="text-[13px] font-extrabold text-muted">
            Oder eure eigene Idee
          </label>
          <input
            id="custom-title"
            name="customTitle"
            value={customTitle}
            onChange={(e) => {
              setCustomTitle(e.target.value);
              setPick({ kind: "custom" });
            }}
            maxLength={120}
            placeholder="z. B. Eis essen und Rhein gucken"
            className={inputClass}
          />
          {pick.kind === "custom" && customTitle.trim() !== "" && (
            <>
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
            </>
          )}
        </div>

        <Sheet ref={moreSheet} title="Was anderes?">
          <MoreIdeas
            size={size}
            events={events}
            aiEnabled={aiEnabled}
            slot={slot ? { startIso: slot.startIso, endIso: slot.endIso, label: `${slot.dateLabel}, ${slot.timeLabel}` } : null}
            onChoose={(chosen) => {
              chooseIdea(chosen);
              moreSheet.current?.close();
            }}
            onEventPlanned={() => setTimeout(() => router.push("/"), 1000)}
          />
        </Sheet>

        {!reschedule && surpriseEnabled && (
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
          </>
        )}

        {slots.length > 0 && (
          <div className="fixed inset-x-0 bottom-[86px] z-10 border-t-[2.5px] border-line bg-surface px-5 pb-3.5 pt-3">
            <div className="mx-auto flex max-w-md flex-col gap-2.5">
              {state.status === "error" && (
                <p role="alert" className="rounded-xl bg-himbeere-soft px-3 py-2 text-sm font-bold text-tinte">
                  {state.message}
                </p>
              )}
              <p className="truncate text-sm font-bold">
                {slot ? `${slot.dateLabel} · ${slot.timeLabel}` : "Wähl eine Zeit"} {title && `· ${title}`}
              </p>
              {budget && (budgetWarning || budget.pot > 0) && (
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
                {pending ? "Wird eingetragen …" : reschedule ? "Termin ändern" : "Date festlegen 🎉"}
              </Button>
              <p className="text-center text-xs font-bold text-muted">
                {reschedule
                  ? `${partnerName} bekommt die Änderung über Google Kalender.`
                  : `Du wirst Organisator:in, ${partnerName} bekommt die Kalender-Einladung.`}
              </p>
            </div>
          </div>
        )}
      </form>
    </>
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
