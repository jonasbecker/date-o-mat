"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/button";
import { cn } from "@/lib/cn";
import { DEFAULT_DEADLINE_DAYS, RHYTHMS, type PlanMode, type Rhythm } from "@/lib/domain";
import { saveCycleSettingsAction, type CycleSettingsState } from "./actions";

const RHYTHM_LABEL: Record<Rhythm, string> = {
  weekly: "Jede Woche",
  biweekly: "Alle 2 Wochen",
  semimonthly: "2× im Monat (1.–15. / 16.–Ende)",
  monthly: "Jeden Monat",
};

const MODES: Array<{ value: PlanMode; title: string; text: string }> = [
  { value: "alternating", title: "Abwechselnd", text: "Pro Runde ist eine Person von euch dran und plant das Date – die andere sagt „Passt!“." },
  { value: "suggestion", title: "Vorschlag", text: "Der Date-O-Mat schlägt Zeit und Idee vor – ihr nehmt an oder wollt einen anderen." },
];

const fieldClass =
  "h-11 w-full rounded-xl border-[2.5px] border-line bg-surface px-3 font-bold text-ink focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

export type CycleSettingsValues = { rhythm: Rhythm; mode: PlanMode; deadlineDaysBeforeEnd: number };

export function CycleSettingsForm({ values }: { values: CycleSettingsValues }) {
  const [state, formAction, pending] = useActionState<CycleSettingsState, FormData>(saveCycleSettingsAction, { status: "idle" });
  const deadline = useRef<HTMLSelectElement>(null);

  return (
    // Remount on new values so React's form reset never shows stale selects.
    <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="rhythm" className="text-[13px] font-extrabold text-muted">
          Rhythmus
        </label>
        <select
          id="rhythm"
          name="rhythm"
          defaultValue={values.rhythm}
          onChange={(event) => {
            // Suggest the deadline that fits the new rhythm.
            if (deadline.current) deadline.current.value = String(DEFAULT_DEADLINE_DAYS[event.target.value as Rhythm]);
          }}
          className={fieldClass}
        >
          {RHYTHMS.map((rhythm) => (
            <option key={rhythm} value={rhythm}>
              {RHYTHM_LABEL[rhythm]}
            </option>
          ))}
        </select>
        <p className="text-xs font-bold text-muted">Ein neuer Rhythmus gilt ab der nächsten Runde.</p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-extrabold text-muted">Modus</legend>
        {MODES.map((mode) => (
          <label
            key={mode.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-2xl border-[2.5px] border-line p-3",
              "has-checked:bg-lavendel has-checked:text-tinte has-checked:shadow-[3px_3px_0_var(--line)]",
            )}
          >
            <input type="radio" name="mode" value={mode.value} defaultChecked={values.mode === mode.value} className="mt-1 size-4 accent-himbeere" />
            <span>
              <span className="block font-display text-lg font-semibold">{mode.title}</span>
              <span className="text-sm font-semibold">{mode.text}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="deadlineDaysBeforeEnd" className="text-[13px] font-extrabold text-muted">
          Plan bis … (Frist)
        </label>
        <select ref={deadline} id="deadlineDaysBeforeEnd" name="deadlineDaysBeforeEnd" defaultValue={values.deadlineDaysBeforeEnd} className={fieldClass}>
          {Array.from({ length: 11 }, (_, days) => (
            <option key={days} value={days}>
              {days === 0 ? "am letzten Tag der Runde, 20 Uhr" : `${days} ${days === 1 ? "Tag" : "Tage"} vor Rundenende, 20 Uhr`}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Speichert …" : "Speichern"}
        </Button>
        <span role="status" className="w-28 text-sm font-extrabold">
          {state.status === "saved" && !pending && "Gespeichert ✓"}
          {state.status === "error" && "Ungültige Auswahl"}
        </span>
      </div>
    </form>
  );
}
