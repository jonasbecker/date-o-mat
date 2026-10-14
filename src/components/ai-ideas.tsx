"use client";

import { useRef, useState, useTransition } from "react";
import { aiIdeasAction, saveAiIdeaAction, type AiIdeasResponse } from "@/app/(app)/ideas/inspiration-actions";
import { BUDGET_LABEL, BUDGETS, MOOD_LABEL, MOODS, SETTING_LABEL, SETTINGS, type AiIdea, type Budget, type Mood, type SettingPref } from "@/core/ai-ideas";
import { cn } from "@/lib/cn";
import type { IdeaSize } from "@/lib/domain";
import { Button, buttonClass } from "./button";
import { Sheet, type SheetHandle } from "./sheet";
import { SizeChip } from "./size-chip";

function Chips<T extends string>({ label, values, labels, value, onChange }: { label: string; values: readonly T[]; labels: Record<T, string>; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-extrabold text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn("h-9 rounded-full border-2 border-line px-3 text-sm font-extrabold", value === v ? "bg-ink text-bg" : "bg-surface text-ink")}
          >
            {labels[v]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * "✨ Ideen von der KI". On the plan page it knows the chosen slot (time, size)
 * and "Nehmen" selects the idea; elsewhere ideas go on the wishlist.
 */
export function AiIdeas({
  slot,
  size,
  onChoose,
  className,
  buttonSize = "md",
  label = "✨ Ideen von der KI",
}: {
  slot?: { startIso: string; endIso: string; label: string } | null;
  size?: IdeaSize;
  onChoose?: (idea: { id: string; title: string }) => void;
  className?: string;
  buttonSize?: "sm" | "md";
  label?: string;
}) {
  const sheet = useRef<SheetHandle>(null);
  const [budget, setBudget] = useState<Budget>("any");
  const [mood, setMood] = useState<Mood>("surprise");
  const [setting, setSetting] = useState<SettingPref>("any");
  const [result, setResult] = useState<AiIdeasResponse | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  function ask() {
    startLoading(async () => {
      setSaved([]);
      setResult(await aiIdeasAction({ budget, mood, setting, size, slot: slot ? { start: slot.startIso, end: slot.endIso } : null }));
    });
  }

  function take(idea: AiIdea) {
    startSaving(async () => {
      const { ideaId } = await saveAiIdeaAction({ title: idea.title, size: idea.size, note: idea.note, costEur: idea.costEur, location: idea.location });
      if (!ideaId) return;
      setSaved((list) => [...list, idea.title]);
      if (onChoose) {
        onChoose({ id: ideaId, title: idea.title });
        sheet.current?.close();
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => sheet.current?.open()} className={buttonClass("secondary", buttonSize, cn("w-full", className))}>
        {label}
      </button>
      <Sheet ref={sheet} title="Ideen von der KI">
        <div className="flex flex-col gap-4">
          {slot && <p className="rounded-xl bg-bg px-3 py-2 text-sm font-bold">📅 Für {slot.label}</p>}
          <Chips label="Budget" values={BUDGETS} labels={BUDGET_LABEL} value={budget} onChange={setBudget} />
          <Chips label="Stimmung" values={MOODS} labels={MOOD_LABEL} value={mood} onChange={setMood} />
          <Chips label="Wo" values={SETTINGS} labels={SETTING_LABEL} value={setting} onChange={setSetting} />
          <Button size="md" className="w-full" disabled={loading} onClick={ask}>
            {loading ? "Denkt nach …" : result?.ok ? "Neue Vorschläge" : "Vorschläge holen"}
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
                  const done = saved.includes(idea.title);
                  return (
                    <article key={idea.title} className="animate-pop-in flex flex-col gap-2 rounded-[20px] border-[2.5px] border-line bg-lavendel/25 p-3.5">
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
                      {done && !onChoose ? (
                        <span className="text-sm font-extrabold">✓ Auf der Wunschliste</span>
                      ) : (
                        <Button variant={onChoose ? "primary" : "secondary"} size="sm" className="self-start" disabled={saving} onClick={() => take(idea)}>
                          {onChoose ? "Nehmen" : "Auf die Wunschliste"}
                        </Button>
                      )}
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
      </Sheet>
    </>
  );
}
