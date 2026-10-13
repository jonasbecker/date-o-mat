"use client";

import { useState } from "react";
import { SIZE_LABEL } from "@/components/size-chip";
import type { SlotMood } from "@/core/slots";
import { cn } from "@/lib/cn";
import { IDEA_SIZES, type IdeaSize } from "@/lib/domain";
import type { SlotView } from "@/lib/format";

const MOOD_LABEL: Record<SlotMood, string> = {
  friday_evening: "Freitagabend",
  evening: "Feierabend",
  weekend_morning: "Brunch-Zeit",
  weekend_afternoon: "Wochenende",
  weekend_evening: "Wochenendabend",
  weekend_day: "Wochenende",
  daytime: "Tagsüber",
};

export function SlotPicker({ small, large, untilLabel }: { small: SlotView[]; large: SlotView[]; untilLabel: string }) {
  const [size, setSize] = useState<IdeaSize>("small");
  const slots = size === "small" ? small : large;

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Größe des Dates" className="grid grid-cols-2 gap-1.5 rounded-[22px] border-[2.5px] border-line bg-surface p-1.5">
        {IDEA_SIZES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={size === option}
            onClick={() => setSize(option)}
            className={cn(
              "flex flex-col items-center rounded-2xl border-2 py-2",
              size === option
                ? cn("border-line text-tinte", option === "small" ? "bg-zitrone" : "bg-lavendel")
                : "border-transparent text-muted",
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
        <span className="text-[13px] font-bold text-muted">ihr seid beide frei</span>
      </div>

      {slots.length === 0 ? (
        <NoSlots size={size} />
      ) : (
        <ol className="flex flex-col gap-2.5">
          {slots.map((slot, index) => (
            <li
              key={slot.key}
              className={cn(
                "animate-pop-in flex items-center gap-3.5 rounded-[20px] border-[2.5px] border-line p-2.5 pr-3.5",
                index === 0 ? "bg-himbeere-soft text-tinte shadow-[4px_4px_0_var(--line)]" : "bg-surface",
              )}
            >
              <span
                className={cn(
                  "flex size-[52px] shrink-0 flex-col items-center justify-center rounded-[14px] border-2 border-line leading-none",
                  index === 0 ? "bg-himbeere" : "bg-bg",
                )}
              >
                <span className="text-xs font-extrabold">{slot.weekday}</span>
                <span className="font-display text-[22px] font-bold">{slot.day}</span>
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-lg font-semibold">{slot.timeLabel}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                  {index === 0 && (
                    <span className="rounded-full border-[1.5px] border-line bg-zitrone px-2 py-px text-tinte">★ Top-Tipp</span>
                  )}
                  <span className={index === 0 ? "" : "text-muted"}>
                    {slot.dateLabel} · {MOOD_LABEL[slot.mood]}
                    {slot.size === "large" && ` · ${slot.durationLabel}`}
                  </span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-center text-[13px] font-bold text-muted">Gesucht bis {untilLabel}</p>
    </div>
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
          ? "Für ein großes Date braucht ihr einen halben Tag am Stück. Vielleicht passt ein kleines Date?"
          : "Eure Kalender sind gerade richtig voll."}{" "}
        In den Einstellungen könnt ihr den Suchzeitraum verlängern oder Puffer und Zeitfenster anpassen.
      </p>
    </div>
  );
}
