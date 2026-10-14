"use client";

import { useOptimistic, useTransition } from "react";
import { EVENT_MIX_LABEL } from "@/core/deck";
import { cn } from "@/lib/cn";
import { EVENT_MIXES, type EventMix } from "@/lib/domain";
import { setEventMixAction } from "./actions";

/** "Events im Stapel: Keine / Ein paar / Viele" – saved on tap. */
export function EventMixPicker({ value }: { value: EventMix }) {
  const [current, setCurrent] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <p id="event-mix-label" className="font-extrabold">
        Event-Kombis im Stapel
      </p>
      <div role="radiogroup" aria-labelledby="event-mix-label" className="grid grid-cols-3 gap-1 rounded-full border-2 border-line bg-surface p-1">
        {EVENT_MIXES.map((mix) => (
          <button
            key={mix}
            type="button"
            role="radio"
            aria-checked={current === mix}
            onClick={() =>
              start(async () => {
                setCurrent(mix);
                await setEventMixAction(mix);
              })
            }
            className={cn("rounded-full py-1.5 text-[14px] font-extrabold", current === mix ? "bg-ink text-bg" : "text-muted")}
          >
            {EVENT_MIX_LABEL[mix]}
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold text-muted">
        Kombis verbinden ein echtes Event aus euren Event-Quellen mit etwas Passendem davor oder danach – z. B. „Konzert, vorher Ramen um die Ecke“.
        Gilt ab den nächsten neuen Karten.
      </p>
    </div>
  );
}
