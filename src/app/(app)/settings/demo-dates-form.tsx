"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { setDemoDatesAction } from "./actions";

/** Test dates in the Archiv – on: seven past dates with reviews, photos and a checklist; off: all gone again. */
export function DemoDatesForm({ on }: { on: boolean }) {
  const [current, setCurrent] = useOptimistic(on);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={current}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            start(async () => {
              setCurrent(next);
              await setDemoDatesAction(next);
            });
          }}
          className="mt-1 size-5 shrink-0 accent-ink"
        />
        <span className="flex flex-col">
          <span className="font-extrabold">🧪 Testdates im Archiv</span>
          <span className="text-sm font-semibold text-muted">
            Sieben vergangene Dates mit Bewertungen, Notizen, Fotos und Checkliste – und eine ausgefallene Runde. Zum Ausprobieren für euch beide; ausschalten löscht sie wieder komplett (eure echten Dates bleiben).
          </span>
        </span>
      </label>
      {current && (
        <Link href="/dates" className="self-start text-sm font-bold underline">
          Zum Archiv ›
        </Link>
      )}
    </div>
  );
}
