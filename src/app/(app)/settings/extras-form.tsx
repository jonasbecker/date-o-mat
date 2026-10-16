"use client";

import { useOptimistic, useTransition } from "react";
import { EXTRAS, type Extra } from "@/lib/domain";
import { setExtraAction } from "./actions";

const EXTRA_TEXT: Record<Extra, { label: string; hint: string }> = {
  surprise: { label: "🎁 Überraschungs-Date", hint: "Beim Planen ab eurem ersten Date: Die andere Person sieht bis zum Tag nur die Zeit." },
  checklist: { label: "✅ Checkliste", hint: "Am geplanten Date: Tisch reservieren, Tickets kaufen … abhaken." },
  cards: { label: "💬 Gesprächskarten", hint: "Am Tag des Dates: Fragen, über die ihr reden könnt." },
  story: { label: "📖 Date-Story", hint: "Euer Jahr zum Durchtippen – ab 3 Dates, im Dezember mit Nachricht." },
};

/** Switch extras on and off – for both of you. Saved on tap. */
export function ExtrasForm({ hidden }: { hidden: Extra[] }) {
  const [current, setCurrent] = useOptimistic(hidden);
  const [, start] = useTransition();
  return (
    <ul className="flex flex-col gap-3.5">
      {EXTRAS.map((extra) => {
        const on = !current.includes(extra);
        return (
          <li key={extra}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={on}
                onChange={(e) => {
                  const shown = e.target.checked;
                  start(async () => {
                    setCurrent(shown ? current.filter((x) => x !== extra) : [...current, extra]);
                    await setExtraAction(extra, shown);
                  });
                }}
                className="mt-1 size-5 shrink-0 accent-himbeere"
              />
              <span className="flex flex-col">
                <span className="font-extrabold">{EXTRA_TEXT[extra].label}</span>
                <span className="text-sm font-semibold text-muted">{EXTRA_TEXT[extra].hint}</span>
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
