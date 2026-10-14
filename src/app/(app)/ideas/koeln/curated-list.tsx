"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/button";
import { SizeChip } from "@/components/size-chip";
import { SurpriseButton } from "@/components/surprise-button";
import { filterCurated, type CuratedFilter, type CuratedIdea, type Setting } from "@/core/curated-ideas";
import type { IdeaSize } from "@/lib/domain";
import { cn } from "@/lib/cn";
import { saveCuratedAction } from "../inspiration-actions";

type Option<T> = { value: T; label: string };

function Chips<T>({ label, options, value, onChange }: { label: string; options: Option<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn("h-9 rounded-full border-2 border-line px-3.5 text-sm font-extrabold", value === option.value ? "bg-ink text-bg" : "bg-surface text-ink")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CuratedList({ ideas, saved }: { ideas: CuratedIdea[]; saved: string[] }) {
  const [filter, setFilter] = useState<CuratedFilter>({});
  const visible = filterCurated(ideas, filter);

  return (
    <div className="flex flex-col gap-4">
      <SurpriseButton variant="primary" />
      <div className="flex flex-col gap-2">
        <Chips<Setting | undefined>
          label="Wo"
          value={filter.setting}
          onChange={(setting) => setFilter({ ...filter, setting })}
          options={[
            { value: undefined, label: "Überall" },
            { value: "indoor", label: "🏠 Drinnen" },
            { value: "outdoor", label: "🌳 Draußen" },
          ]}
        />
        <Chips<number | undefined>
          label="Budget"
          value={filter.maxCostEur}
          onChange={(maxCostEur) => setFilter({ ...filter, maxCostEur })}
          options={[
            { value: undefined, label: "Jedes Budget" },
            { value: 0, label: "Gratis" },
            { value: 30, label: "bis 30 €" },
          ]}
        />
        <Chips<IdeaSize | undefined>
          label="Größe"
          value={filter.size}
          onChange={(size) => setFilter({ ...filter, size })}
          options={[
            { value: undefined, label: "Alle" },
            { value: "small", label: "Klein" },
            { value: "large", label: "Groß" },
          ]}
        />
      </div>
      <p className="text-[13px] font-bold text-muted">
        {visible.length} {visible.length === 1 ? "Idee" : "Ideen"} · Preise grob für zwei, Öffnungszeiten vorher kurz prüfen.
      </p>
      <ul className="flex flex-col gap-3">
        {visible.map((idea) => (
          <li key={idea.id}>
            <CuratedCard idea={idea} saved={saved.includes(idea.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CuratedCard({ idea, saved }: { idea: CuratedIdea; saved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <article className="sticker flex flex-col gap-2 rounded-[20px] bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-lg font-semibold leading-snug">{idea.title}</h2>
        <SizeChip size={idea.size} className="mt-0.5 shrink-0" />
      </div>
      <p className="flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] font-extrabold text-muted">
        <span>{idea.setting === "indoor" ? "🏠 Drinnen" : "🌳 Draußen"}</span>
        <span>{idea.costEur === 0 ? "gratis" : `~${idea.costEur} €`}</span>
        <span>📍 {idea.location}</span>
      </p>
      <p className="text-sm font-semibold text-muted">{idea.note}</p>
      {saved ? (
        <span className="text-sm font-extrabold text-muted">💡 Auf der Wunschliste</span>
      ) : (
        <Button variant="secondary" size="sm" className="self-start" disabled={pending} onClick={() => start(async () => void (await saveCuratedAction(idea.id)))}>
          Auf die Wunschliste
        </Button>
      )}
    </article>
  );
}
