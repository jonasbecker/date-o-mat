"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { Button } from "@/components/button";
import { addSpecialDayAction, deleteSpecialDayAction, type SpecialDayFormState } from "./actions";

export type SpecialDayView = { id: string; emoji: string; label: string; dateLabel: string; inDays: string };

const inputClass = "h-12 w-full rounded-[22px] bg-soft px-4 font-bold text-ink";

/** Jahrestag, Geburtstage, eigene Tage – mit Erinnerung 2 Wochen und 2 Tage vorher. */
export function SpecialDays({ days: allDays, people }: { days: SpecialDayView[]; people: Array<{ id: string; name: string }> }) {
  const [kind, setKind] = useState("anniversary");
  const [formKey, setFormKey] = useState(0);
  const [, startDelete] = useTransition();
  // A removed day is gone at once – before the server answers.
  const [days, hideDay] = useOptimistic(allDays, (current, id: string) => current.filter((d) => d.id !== id));
  const [state, action, pending] = useActionState<SpecialDayFormState, FormData>(async (prev, formData) => {
    const result = await addSpecialDayAction(prev, formData);
    if (result.status === "saved") {
      setFormKey((k) => k + 1);
      setKind("anniversary");
    }
    return result;
  }, { status: "idle" });

  return (
    <div className="flex flex-col gap-4">
      {days.length > 0 && (
        <ul className="flex flex-col gap-2">
          {days.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-extrabold">
                  {d.emoji} {d.label}
                </span>
                <span className="text-sm font-bold text-muted">
                  {d.dateLabel} · {d.inDays}
                </span>
              </span>
              <button
                type="button"
                aria-label={`${d.label} entfernen`}
                onClick={() => startDelete(async () => {
                  hideDay(d.id);
                  await deleteSpecialDayAction(d.id);
                })}
                className="shrink-0 text-sm font-extrabold text-muted underline"
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
      )}
      <form key={formKey} action={action} className="flex flex-col gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-track p-3">
        <label htmlFor="special-kind" className="text-[13px] font-extrabold text-muted">
          Besonderer Tag
        </label>
        <select id="special-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
          <option value="anniversary">💞 Jahrestag</option>
          {people.map((p) => (
            <option key={p.id} value={`birthday:${p.id}`}>
              🎂 Geburtstag von {p.name}
            </option>
          ))}
          <option value="other">⭐ Eigener Tag</option>
        </select>
        {kind === "other" && (
          <>
            <label htmlFor="special-title" className="text-[13px] font-extrabold text-muted">
              Name
            </label>
            <input id="special-title" name="title" maxLength={60} placeholder="z. B. Unser erstes Date" className={inputClass} />
          </>
        )}
        <label htmlFor="special-date" className="text-[13px] font-extrabold text-muted">
          {kind === "anniversary" ? "Seit wann seid ihr zusammen?" : kind === "other" ? "Datum (das erste Mal)" : "Geburtsdatum"}
        </label>
        <input id="special-date" name="date" type="date" required className={inputClass} />
        {state.status === "error" && (
          <p role="alert" className="text-sm font-bold">
            {state.message}
          </p>
        )}
        <Button type="submit" size="sm" disabled={pending} className="self-start">
          {pending ? "…" : "Hinzufügen"}
        </Button>
        <p className="text-xs font-bold text-muted">
          Erinnerung 2 Wochen und 2 Tage vorher. Bei Geburtstagen bekommt nur die andere Person die Erinnerung – für die Überraschung.
        </p>
      </form>
    </div>
  );
}
