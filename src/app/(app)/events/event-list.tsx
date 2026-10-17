"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { matchesIdeaFilter } from "@/core/filters";
import { cn } from "@/lib/cn";
import { planEventAction, saveEventIdeaAction } from "./actions";

export type EventView = {
  id: string;
  title: string;
  time: string;
  venue: string | null;
  price: string | null;
  /** Rough price for both, from the price text (null = unknown) – for the shared filter. */
  costEur: number | null;
  summary: string | null;
  url: string | null;
  source: string;
  /** Both free at that time? null = unknown (all-day, or calendars not readable). */
  free: boolean | null;
  plannable: boolean;
  saved: boolean;
  /** "Samstag, 17. Okt, 20:00" – for the confirmation. */
  when: string;
};

export type EventGroup = { heading: string; events: EventView[] };

type Filter = "all" | "free";

export function EventList({
  groups,
  tips,
  calendarsReadable,
  initialFilter,
}: {
  groups: EventGroup[];
  tips: EventView[];
  calendarsReadable: boolean;
  initialFilter: Filter;
}) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [shared] = useIdeaFilter();
  const fits = (e: EventView) => matchesIdeaFilter({ costEur: e.costEur }, { ...shared, size: undefined, setting: undefined });
  const visible = groups
    .map((g) => ({ ...g, events: g.events.filter((e) => fits(e) && (filter === "all" || e.free === true)) }))
    .filter((g) => g.events.length > 0);
  const total = groups.reduce((n, g) => n + g.events.length, 0);
  const shownTips = tips.filter(fits);

  return (
    <div className="flex flex-col gap-5">
      {total + tips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {calendarsReadable && total > 0 && (
            <button
              type="button"
              aria-pressed={filter === "free"}
              onClick={() => setFilter(filter === "free" ? "all" : "free")}
              className={cn("h-9 rounded-full border-2 border-line px-3.5 text-sm font-extrabold", filter === "free" ? "bg-ink text-bg" : "bg-surface text-ink")}
            >
              ✓ Nur wenn ihr Zeit habt
            </button>
          )}
          <FilterButton />
        </div>
      )}

      {total === 0 && (
        <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-3 font-bold">
          Gerade nichts gefunden. Die Quellen werden jeden Morgen neu gelesen.
        </p>
      )}
      {total > 0 && visible.length === 0 && (
        <p className="rounded-[20px] border-2 border-dashed border-line px-4 py-3 font-bold">
          {filter === "free" ? "In den nächsten drei Wochen passt leider nichts in eure freie Zeit." : "Gerade nichts, was zum Filter passt."}
        </p>
      )}

      {visible.map((group) => (
        <section key={group.heading} className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">{group.heading}</h2>
          <ul className="flex flex-col gap-3">
            {group.events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {shownTips.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[17px] font-semibold">Tipps ohne festen Termin</h2>
          <ul className="flex flex-col gap-3">
            {shownTips.map((tip) => (
              <li key={tip.id}>
                <EventCard event={tip} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One event with "Als Date planen" (two steps) and "Merken". */
export function EventCard({ event, onPlanned }: { event: EventView; onPlanned?: () => void }) {
  const celebrate = useCelebrate();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);
  const [saving, startSave] = useTransition();
  const [planning, startPlan] = useTransition();

  return (
    <article className="sticker flex flex-col gap-2 rounded-[20px] bg-surface p-3.5">
      <div className="flex items-start gap-3">
        {event.time && (
          <span className="mt-0.5 shrink-0 rounded-full border-2 border-line bg-zitrone px-2 py-px text-[13px] font-extrabold text-tinte">{event.time}</span>
        )}
        <h3 className="font-display text-lg font-semibold leading-snug">{event.title}</h3>
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] font-extrabold text-muted">
        {event.venue && <span>📍 {event.venue}</span>}
        {event.price && <span>{event.price}</span>}
        {event.url ? (
          <a href={event.url} target="_blank" rel="noopener noreferrer" className="underline decoration-2 underline-offset-2">
            🔗 {event.source}
          </a>
        ) : (
          <span>via {event.source}</span>
        )}
      </p>
      {event.summary && <p className="line-clamp-2 text-sm font-semibold text-muted">{event.summary}</p>}
      {event.free === true && (
        <p className="flex items-center gap-2 self-start rounded-full bg-minze-soft py-0.5 pl-2.5 pr-1 text-[13px] font-extrabold text-tinte">
          ✓ Ihr habt beide Zeit
        </p>
      )}
      {event.free === false && <p className="text-[13px] font-bold text-muted">Da ist mindestens einer von euch schon verplant.</p>}

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-bg p-3">
          <p className="font-bold">
            {event.when} als euer Date planen? Ihr bekommt beide eine Einladung in Google Kalender.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              size="sm"
              disabled={planning}
              onClick={() =>
                startPlan(async () => {
                  const result = await planEventAction(event.id);
                  if (result.ok) {
                    celebrate();
                    setPlanned(true);
                    setConfirming(false);
                    onPlanned?.();
                  } else setMessage(result.message ?? "Das hat nicht geklappt.");
                })
              }
            >
              {planning ? "Plant …" : "Ja, planen 🎉"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {planned ? (
            <span className="text-sm font-extrabold">🎉 Geplant!</span>
          ) : (
            event.plannable &&
            event.free !== false && (
              <Button size="sm" onClick={() => (setMessage(null), setConfirming(true))}>
                Als Date planen
              </Button>
            )
          )}
          {event.saved ? (
            <span className="text-sm font-extrabold text-muted">💡 Auf der Wunschliste</span>
          ) : (
            <Button variant="secondary" size="sm" disabled={saving} onClick={() => startSave(async () => void (await saveEventIdeaAction(event.id)))}>
              Merken
            </Button>
          )}
        </div>
      )}
      {message && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
          {message}
        </p>
      )}
    </article>
  );
}
