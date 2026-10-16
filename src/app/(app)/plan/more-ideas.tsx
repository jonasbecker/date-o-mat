"use client";

import { useState, useTransition } from "react";
import { AiIdeas } from "@/components/ai-ideas";
import { Button } from "@/components/button";
import { FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { CURATED_IDEAS } from "@/core/curated-ideas";
import { matchesIdeaFilter } from "@/core/filters";
import type { IdeaSize } from "@/lib/domain";
import { EventCard, type EventView } from "../events/event-list";
import { saveCuratedAction } from "../ideas/inspiration-actions";

function matchesSearch(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}

/**
 * "Was anderes?" in the planning flow: everything that is not on the wishlist in one
 * list – events where both are free, the Köln ideas and the AI – with one search.
 */
export function MoreIdeas({
  size,
  events,
  aiEnabled,
  slot,
  onChoose,
  onEventPlanned,
}: {
  /** Only ideas of this length; without it the shared filter decides. */
  size?: IdeaSize;
  /** null = no event sources set up */
  events: EventView[] | null;
  aiEnabled: boolean;
  /** The time the AI plans for (its length counts when no size is given). */
  slot: { startIso: string; endIso: string; label: string; size?: IdeaSize } | null;
  onChoose: (idea: { id: string; title: string; size?: IdeaSize }) => void;
  onEventPlanned: () => void;
}) {
  const [filter] = useIdeaFilter();
  const [query, setQuery] = useState("");
  const [saving, startSaving] = useTransition();
  const shownEvents = (events ?? []).filter((e) => matchesIdeaFilter({ costEur: e.costEur }, filter) && matchesSearch(query, e.title, e.venue, e.summary));
  const curated = CURATED_IDEAS.filter(
    (c) =>
      (size ? c.size === size && matchesIdeaFilter({ costEur: c.costEur, setting: c.setting }, { ...filter, size: undefined }) : matchesIdeaFilter({ size: c.size, costEur: c.costEur, setting: c.setting }, filter)) &&
      matchesSearch(query, c.title, c.location, c.note),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen, z. B. Kino, Rhein, Essen"
          aria-label="Ideen durchsuchen"
          className="h-10 min-w-0 flex-1 rounded-full border-2 border-line bg-surface px-4 font-bold placeholder:font-semibold placeholder:text-muted/70 focus:outline-none"
        />
        <FilterButton />
      </div>

      {shownEvents.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-muted">🎟️ Events – ihr habt beide Zeit</h3>
          <p className="-mt-1 text-xs font-bold text-muted">Wird direkt zur Event-Zeit eingetragen, unabhängig vom Termin oben.</p>
          <ul className="flex flex-col gap-3">
            {shownEvents.map((event) => (
              <li key={event.id}>
                <EventCard event={event} onPlanned={onEventPlanned} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-muted">📍 Ideen für Köln</h3>
        {curated.length === 0 ? (
          <p className="text-sm font-bold text-muted">Nichts Passendes{query ? ` zu „${query}“` : ""}.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {curated.map((option) => (
              <li key={option.id} className="flex items-center gap-3 rounded-[18px] border-2 border-line bg-surface px-3 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-display font-semibold leading-snug">{option.title}</span>
                  <span className="text-xs font-extrabold text-muted">
                    {option.setting === "indoor" ? "🏠 Drinnen" : "🌳 Draußen"} · {option.costEur === 0 ? "gratis" : `~${option.costEur} €`} · 📍 {option.location}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={saving}
                  onClick={() =>
                    startSaving(async () => {
                      const { ideaId } = await saveCuratedAction(option.id);
                      if (ideaId) onChoose({ id: ideaId, title: option.title, size: option.size });
                    })
                  }
                >
                  Nehmen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aiEnabled && (
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-muted">✨ Ganz was Neues</h3>
          <AiIdeas size={size ?? filter.size ?? slot?.size} slot={slot} onChoose={onChoose} />
        </section>
      )}
    </div>
  );
}
