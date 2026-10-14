"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/button";
import { formatHours, minutesToTime, SLOT_OPTIONS, type SlotSettingsValues } from "@/lib/slot-settings";
import { saveSlotSettingsAction, type SlotSettingsState } from "./actions";

const fieldClass =
  "h-11 w-full rounded-xl border-[2.5px] border-line bg-surface px-3 font-bold text-ink focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

function Field({ label, htmlFor, error, children }: { label: string; htmlFor: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[13px] font-extrabold text-muted">
        {label}
      </label>
      {children}
      {error && <p className="text-sm font-bold">{error}</p>}
    </div>
  );
}

function Select({ name, options, value, format }: { name: keyof typeof SLOT_OPTIONS; options: readonly number[]; value: string; format: (v: number) => string }) {
  return (
    <select id={name} name={name} defaultValue={value} className={fieldClass}>
      {options.map((option) => (
        <option key={option} value={option}>
          {format(option)}
        </option>
      ))}
    </select>
  );
}

function Time({ name, value }: { name: keyof SlotSettingsValues; value: string }) {
  return <input id={name} name={name} type="time" step={1800} defaultValue={value} required className={fieldClass} />;
}

export function SlotSettingsForm({ values }: { values: SlotSettingsValues }) {
  const [state, formAction, pending] = useActionState<SlotSettingsState, FormData>(saveSlotSettingsAction, { status: "idle" });
  const e = state.errors ?? {};
  // After a failed submit show what was entered, otherwise the saved settings.
  const typed = state.status === "error" ? state.values : undefined;
  const time = (key: keyof SlotSettingsValues) => typed?.[key] ?? minutesToTime(values[key]);
  const num = (key: keyof SlotSettingsValues) => typed?.[key] ?? String(values[key]);

  return (
    // Remount the form when the saved values change: React's automatic form reset
    // would otherwise put <select>s back to their very first default.
    <form key={JSON.stringify(values)} action={formAction} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg font-semibold">☕ Kurzes Date</legend>
        <Field label="Dauer" htmlFor="smallDurationMinutes" error={e.smallDurationMinutes}>
          <Select name="smallDurationMinutes" options={SLOT_OPTIONS.smallDurationMinutes} value={num("smallDurationMinutes")} format={formatHours} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start frühestens" htmlFor="smallStartFromMinute" error={e.smallStartFromMinute}>
            <Time name="smallStartFromMinute" value={time("smallStartFromMinute")} />
          </Field>
          <Field label="Start spätestens" htmlFor="smallStartUntilMinute" error={e.smallStartUntilMinute}>
            <Time name="smallStartUntilMinute" value={time("smallStartUntilMinute")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg font-semibold">🎡 Langes Date</legend>
        <Field label="Mindestens" htmlFor="largeMinDurationMinutes" error={e.largeMinDurationMinutes}>
          <Select name="largeMinDurationMinutes" options={SLOT_OPTIONS.largeMinDurationMinutes} value={num("largeMinDurationMinutes")} format={formatHours} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start frühestens" htmlFor="largeStartFromMinute" error={e.largeStartFromMinute}>
            <Time name="largeStartFromMinute" value={time("largeStartFromMinute")} />
          </Field>
          <Field label="Start spätestens" htmlFor="largeStartUntilMinute" error={e.largeStartUntilMinute}>
            <Time name="largeStartUntilMinute" value={time("largeStartUntilMinute")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-display text-lg font-semibold">Für beide</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Spätestes Ende" htmlFor="latestEndMinute" error={e.latestEndMinute}>
            <Time name="latestEndMinute" value={time("latestEndMinute")} />
          </Field>
          <Field label="Vorlauf" htmlFor="minLeadHours" error={e.minLeadHours}>
            <Select name="minLeadHours" options={SLOT_OPTIONS.minLeadHours} value={num("minLeadHours")} format={(h) => `${h} Std.`} />
          </Field>
          <Field label="Puffer um Termine" htmlFor="bufferMinutes" error={e.bufferMinutes}>
            <Select name="bufferMinutes" options={SLOT_OPTIONS.bufferMinutes} value={num("bufferMinutes")} format={(m) => (m === 0 ? "keiner" : `${m} Min.`)} />
          </Field>
          <Field label="Suchen für" htmlFor="horizonDays" error={e.horizonDays}>
            <Select name="horizonDays" options={SLOT_OPTIONS.horizonDays} value={num("horizonDays")} format={(d) => `${d} Tage`} />
          </Field>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? "Speichert …" : "Speichern"}
        </Button>
        <span role="status" className="w-28 text-sm font-extrabold">
          {state.status === "saved" && !pending && "Gespeichert ✓"}
        </span>
      </div>
    </form>
  );
}
