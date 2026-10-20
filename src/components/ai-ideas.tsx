"use client";

import { useState, useTransition } from "react";
import { aiIdeasAction, saveAiIdeaAction, type AiIdeasResponse } from "@/app/(app)/ideas/inspiration-actions";
import type { AiIdea, Budget, SettingPref } from "@/core/ai-ideas";
import type { IdeaSize } from "@/lib/domain";
import { Button } from "./button";
import { useIdeaFilter } from "./idea-filter";
import { SizeChip } from "./size-chip";

/**
 * "✨ Frag die KI" inside the plan page's idea picker: three ideas for the chosen
 * slot and length, following the shared filter (budget, inside/outside).
 * "Nehmen" puts the idea on the wishlist and selects it.
 */
export function AiIdeas({
  slot,
  size,
  onChoose,
}: {
  slot?: { startIso: string; endIso: string; label: string } | null;
  size?: IdeaSize;
  onChoose: (idea: { id: string; title: string }) => void;
}) {
  const [filter] = useIdeaFilter();
  const [result, setResult] = useState<AiIdeasResponse | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();
  const budget: Budget = filter.budget === "free" ? "free" : filter.budget === "cheap" ? "low" : "any";
  const setting: SettingPref = filter.setting ?? "any";

  function ask() {
    startLoading(async () => {
      setResult(await aiIdeasAction({ budget, mood: "surprise", setting, size, slot: slot ? { start: slot.startIso, end: slot.endIso } : null }));
    });
  }

  function take(idea: AiIdea) {
    startSaving(async () => {
      const { ideaId } = await saveAiIdeaAction({ title: idea.title, size: idea.size, note: idea.note, costEur: idea.costEur, location: idea.location, setting: idea.setting });
      if (ideaId) onChoose({ id: ideaId, title: idea.title });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="secondary" size="md" className="w-full" disabled={loading} onClick={ask}>
        {loading ? "Denkt nach …" : result?.ok ? "✨ Andere Vorschläge" : "✨ 3 Ideen von der KI"}
      </Button>

      <div aria-live="polite" className="flex flex-col gap-3">
        {loading && <div className="h-40 animate-pulse rounded-[20px] bg-track" />}
        {!loading && result && !result.ok && (
          <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
            {result.message}
          </p>
        )}
        {!loading && result?.ok && (
          <>
            {result.weather && <p className="text-sm font-bold">🌦️ Wetter: {result.weather}</p>}
            {result.ideas.map((idea) => {
              return (
                <article key={idea.title} className="animate-pop-in flex flex-col gap-2 rounded-[20px] bg-lavendel/25 p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold leading-snug">{idea.title}</h3>
                    <SizeChip size={idea.size} className="mt-0.5 shrink-0" />
                  </div>
                  <p className="flex flex-wrap gap-x-2.5 text-[13px] font-extrabold text-muted">
                    <span>{idea.setting === "indoor" ? "🏠 Drinnen" : "🌳 Draußen"}</span>
                    {idea.costEur !== null && <span>{idea.costEur === 0 ? "gratis" : `~${idea.costEur} €`}</span>}
                    {idea.location && <span>📍 {idea.location}</span>}
                  </p>
                  {idea.note && <p className="text-sm font-semibold">{idea.note}</p>}
                  {idea.why && <p className="text-[13px] font-bold text-muted">💡 {idea.why}</p>}
                  <Button size="sm" className="self-start" disabled={saving} onClick={() => take(idea)}>
                    Nehmen
                  </Button>
                </article>
              );
            })}
            <p className="text-center text-[13px] font-bold text-muted">
              Noch {result.left} Vorschlags-Runden heute · KI kann sich irren, Details vorher prüfen.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
