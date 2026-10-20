"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { setBudgetAction, type BudgetFormState } from "./actions";

export function BudgetForm({ budget }: { budget: number | null }) {
  const [state, action, pending] = useActionState<BudgetFormState, FormData>(setBudgetAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="budget-input" className="font-extrabold">
        Monatsbudget für Dates
      </label>
      <div className="flex items-center gap-2">
        <input
          id="budget-input"
          name="budget"
          defaultValue={budget ?? ""}
          inputMode="numeric"
          placeholder="z. B. 80"
          className="h-12 w-28 rounded-[22px] bg-soft px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70"
        />
        <span className="font-bold">€ im Monat</span>
        <Button type="submit" size="sm" disabled={pending} className="ml-auto">
          {pending ? "…" : "Speichern"}
        </Button>
      </div>
      {state.status === "saved" && <p className="text-sm font-bold">Gespeichert ✓</p>}
      {state.status === "error" && (
        <p role="alert" className="text-sm font-bold">
          {state.message}
        </p>
      )}
      <p className="text-sm font-semibold text-muted">
        Gezählt wird, was ein Date kostet (geschätzt beim Planen, den echten Betrag tragt ihr beim Rückblick ein). Was am Monatsende übrig ist, wandert in den
        🎁 Spartopf – für ein großes Date. Leer lassen = kein Budget.
      </p>
    </form>
  );
}
