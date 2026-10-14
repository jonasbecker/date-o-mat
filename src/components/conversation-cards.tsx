"use client";

import { useState } from "react";
import { CONVERSATION_CARDS, nextCard } from "@/core/date-extras";

/** "💬 Gesprächskarte ziehen" – a question for a quiet moment. */
export function ConversationCards({ compact = false }: { compact?: boolean }) {
  const [seen, setSeen] = useState<number[]>([]);
  const current = seen.at(-1);
  // Random pick in the event handler, not in a state updater (those must be pure).
  const draw = () => setSeen([...seen, nextCard(seen)]);
  if (current === undefined) {
    return (
      <button type="button" onClick={draw} className={compact ? "self-start text-sm font-extrabold underline" : "sticker press rounded-[20px] bg-lavendel px-4 py-3 font-display text-lg font-semibold text-tinte"}>
        💬 Gesprächskarte ziehen
      </button>
    );
  }
  return (
    <div className="sticker flex flex-col gap-3 rounded-[22px] bg-lavendel px-5 py-4 text-tinte">
      <p className="text-[13px] font-extrabold uppercase tracking-wide">💬 Gesprächskarte</p>
      <p aria-live="polite" className="font-display text-xl font-semibold leading-snug">
        {CONVERSATION_CARDS[current]}
      </p>
      <button type="button" onClick={draw} className="self-start text-sm font-extrabold underline">
        Nächste Karte →
      </button>
    </div>
  );
}
