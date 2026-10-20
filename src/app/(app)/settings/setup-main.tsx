"use client";

// The setup page as in MSetup: who plans, rhythm, deadline; reminders; the calendars and "Freie Abende ab".
// Every control saves on its own (no "Speichern") and says so with a small ✓.
import Link from "next/link";
import { useActionState, useRef } from "react";
import { usePush } from "@/components/use-push";
import { cn } from "@/lib/cn";
import { DEFAULT_DEADLINE_DAYS, RHYTHMS, type PlanMode, type Rhythm } from "@/lib/domain";
import { minutesToTime, type SlotSettingsValues } from "@/lib/slot-settings";
import { saveCycleSettingsAction, saveSlotSettingsAction, type CycleSettingsState, type SlotSettingsState } from "./actions";

const RHYTHM_LABEL: Record<Rhythm, string> = {
  weekly: "jede Woche",
  biweekly: "alle 2 Wochen",
  semimonthly: "2× im Monat",
  monthly: "jeden Monat",
};

const MODES: Array<{ value: PlanMode; label: string }> = [
  { value: "alternating", label: "Abwechselnd" },
  { value: "suggestion", label: "Vorschlag" },
];

const rowClass = "flex min-h-11 items-center justify-between gap-3";
const selectClass = "max-w-[60%] cursor-pointer appearance-none bg-transparent text-right text-base text-muted outline-none focus-visible:text-ink";

function Saved({ show, className }: { show: boolean; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("w-4 text-center text-xs text-leaf", className)}>
      {show ? "✓" : ""}
    </span>
  );
}

/** Wer plant? (Abwechselnd / Vorschlag), Rhythmus and Frist. */
export function CycleQuick({ values }: { values: { rhythm: Rhythm; mode: PlanMode; deadlineDaysBeforeEnd: number } }) {
  const [state, action, pending] = useActionState<CycleSettingsState, FormData>(saveCycleSettingsAction, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const deadline = useRef<HTMLSelectElement>(null);
  const submit = () => form.current?.requestSubmit();

  return (
    <form key={JSON.stringify(values)} ref={form} action={action} className="relative flex flex-col gap-3">
      <p className="text-[13px] text-muted">Wer plant?</p>
      <div role="radiogroup" aria-label="Wer plant?" className="grid grid-cols-2 gap-1 rounded-full bg-soft p-1">
        {MODES.map((mode) => (
          <label key={mode.value} className="cursor-pointer">
            <input type="radio" name="mode" value={mode.value} defaultChecked={values.mode === mode.value} onChange={submit} className="peer sr-only" />
            <span className="flex h-10 items-center justify-center rounded-full text-[15px] font-semibold text-ink peer-checked:bg-tinte peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-himmel dark:peer-checked:bg-leaf">
              {mode.label}
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-col border-t border-soft pt-1">
        <label className={rowClass}>
          <span className="text-base font-semibold">Rhythmus</span>
          <select
            name="rhythm"
            aria-label="Rhythmus"
            defaultValue={values.rhythm}
            onChange={(event) => {
              // The deadline that fits the new rhythm.
              if (deadline.current) deadline.current.value = String(DEFAULT_DEADLINE_DAYS[event.target.value as Rhythm]);
              submit();
            }}
            className={selectClass}
          >
            {RHYTHMS.map((rhythm) => (
              <option key={rhythm} value={rhythm}>
                {RHYTHM_LABEL[rhythm]}
              </option>
            ))}
          </select>
        </label>
        <label className={rowClass}>
          <span className="text-base font-semibold">Frist</span>
          <select ref={deadline} name="deadlineDaysBeforeEnd" aria-label="Plan bis … (Frist)" defaultValue={values.deadlineDaysBeforeEnd} onChange={submit} className={selectClass}>
            {Array.from({ length: 11 }, (_, days) => (
              <option key={days} value={days}>
                {days === 0 ? "letzter Tag, 20:00" : `${days} ${days === 1 ? "Tag" : "Tage"} vorher, 20:00`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Saved show={state.status === "saved" && !pending} className="absolute right-0 top-0" />
      {state.status === "error" && <p role="alert" className="text-sm text-tinte">Ungültige Auswahl.</p>}
    </form>
  );
}

/** The reminder switch for this device. */
export function PushToggle({ publicKey, partnerName }: { publicKey: string | null; partnerName: string }) {
  const push = usePush(publicKey);
  const on = Boolean(push.subscription);
  const unavailable = !publicKey || push.support === "unsupported" || push.support === "ios-browser" || push.permission === "denied";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col gap-0.5">
          <span className="text-base font-semibold">Push-Erinnerung</span>
          <span className="text-[13px] leading-snug text-muted">Wenn du dran bist · wenn’s knapp wird · wenn {partnerName} etwas plant</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Push-Erinnerung"
          disabled={push.support === null || push.pending || (!on && unavailable)}
          onClick={() => (on ? push.disable() : push.enable())}
          className={cn("relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-leaf" : "bg-track")}
        >
          <span className={cn("absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow transition-transform duration-200 ease-out", on && "translate-x-5")} />
        </button>
      </div>
      {push.message && <p role="status" className="text-sm text-muted">{push.message}</p>}
      {push.support !== null && !on && unavailable && (
        <p className="text-sm text-muted">
          {push.permission === "denied" ? "Der Browser blockiert sie." : "Hier gehen sie erst als App."}{" "}
          <Link href="/settings?t=push" className="font-semibold underline">
            So geht’s
          </Link>
        </p>
      )}
    </div>
  );
}

const EVENING_OPTIONS = [16 * 60, 16 * 60 + 30, 17 * 60, 17 * 60 + 30, 18 * 60, 18 * 60 + 30, 19 * 60, 19 * 60 + 30, 20 * 60];

/** "Freie Abende ab 18:00": the earliest start of a short date. */
export function EveningFrom({ values }: { values: SlotSettingsValues }) {
  const [state, action, pending] = useActionState<SlotSettingsState, FormData>(saveSlotSettingsAction, { status: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const options = EVENING_OPTIONS.includes(values.smallStartFromMinute) ? EVENING_OPTIONS : [...EVENING_OPTIONS, values.smallStartFromMinute].sort((a, b) => a - b);
  return (
    <form key={JSON.stringify(values)} ref={form} action={action} className="border-t border-soft pt-1">
      {(Object.keys(values) as Array<keyof SlotSettingsValues>)
        .filter((key) => key !== "smallStartFromMinute")
        .map((key) => (
          <input key={key} type="hidden" name={key} value={key.endsWith("Minute") ? minutesToTime(values[key]) : String(values[key])} />
        ))}
      <label className={rowClass}>
        <span className="text-base font-semibold">Freie Abende ab</span>
        <span className="flex items-center gap-2">
          <select name="smallStartFromMinute" aria-label="Freie Abende ab" defaultValue={minutesToTime(values.smallStartFromMinute)} onChange={() => form.current?.requestSubmit()} className={selectClass}>
            {options.map((minutes) => (
              <option key={minutes} value={minutesToTime(minutes)}>
                {minutesToTime(minutes)}
              </option>
            ))}
          </select>
          <Saved show={state.status === "saved" && !pending} />
        </span>
      </label>
      {state.status === "error" && <p role="alert" className="text-sm text-tinte">Das passt nicht zu den anderen Zeiten – siehe „Freie Zeiten finden“.</p>}
    </form>
  );
}
