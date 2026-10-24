"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { DevDateState } from "@/server/dev-date";
import { devDateAction } from "./actions";

const CHOICES: Array<[DevDateState, string]> = [
  ["none", "Kein Date"],
  ["mine", "Ich schlage vor"],
  ["theirs", "Partner schlägt vor"],
  ["confirmed", "Date steht"],
];

const ERRORS = {
  no_round: "Es gibt noch keine Runde – ihr braucht beide ein Konto.",
  round_done: "Diese Runde ist schon vorbei oder hatte ihr Date – stell die Dev-Uhr weiter.",
};

/** Dev tools: the round with or without a date, without planning one together. */
export function DevDateForm({ state, partnerName }: { state: DevDateState; partnerName: string }) {
  const [current, setCurrent] = useOptimistic(state);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div data-dev-date={current} className="flex flex-col gap-3">
      <h3 className="font-display text-lg font-semibold">Test-Date 🧪</h3>
      <div role="radiogroup" aria-label="Test-Date" className="flex flex-wrap gap-2">
        {CHOICES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setCurrent(value);
                setError(null);
                const result = await devDateAction(value);
                if (!result.ok) setError(ERRORS[result.error]);
              })
            }
            className={cn(
              "press h-9 rounded-full px-3.5 text-sm font-bold",
              current === value ? "bg-cta text-bg" : "border-2 border-[#3A4A40]",
            )}
          >
            {value === "theirs" ? `${partnerName} schlägt vor` : label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
          {error}
        </p>
      )}
      <p className="text-sm font-semibold text-muted">
        Legt ein Date in die laufende Runde (heute oder morgen 19 Uhr, eine Idee von eurer Liste) – ohne Google-Kalender und ohne Push. „Kein Date“ nimmt es wieder raus; ein echtes Date wird dabei abgesagt.
      </p>
      {current !== "none" && (
        <Link href="/plan" className="self-start text-sm font-bold underline">
          Zum Beet ›
        </Link>
      )}
    </div>
  );
}
