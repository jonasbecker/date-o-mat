"use client";

import { useActionState, useState } from "react";
import { HeartShape } from "@/components/hearts";
import { Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { cn } from "@/lib/cn";
import { AGAIN_ANSWERS, AGAIN_LABEL, RATING_MAX, REVIEW_NOTE_MAX, type AgainAnswer } from "@/lib/domain";
import { saveReviewAction, type ReviewFormState } from "./actions";

const MOODS = ["", "Naja 😕", "Ganz okay 🙂", "Schön 😊", "Richtig schön 🥰", "Unvergesslich 🤩"];

export function ReviewForm({
  dateId,
  rating,
  note,
  cost,
  again: savedAgain = null,
  initialHearts = 0,
}: {
  dateId: string;
  rating: number | null;
  note: string | null;
  cost: number | null;
  again?: AgainAnswer | null;
  /** From a tap on a heart on the start page. */
  initialHearts?: number;
}) {
  const celebrate = useCelebrate();
  const [hearts, setHearts] = useState(rating ?? initialHearts);
  const [again, setAgain] = useState<AgainAnswer | null>(savedAgain);
  const [editing, setEditing] = useState(rating === null);
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(async (prev, formData) => {
    const result = await saveReviewAction(prev, formData);
    if (result.status === "saved") {
      if (rating === null) celebrate();
      setEditing(false);
    }
    return result;
  }, { status: "idle" });

  if (!editing && rating !== null) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="self-start text-sm font-semibold text-muted underline">
        Meine Bewertung ändern
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="dateId" value={dateId} />
      <fieldset className="flex flex-col items-center gap-2">
        <legend className="sr-only">Wie viele Herzen?</legend>
        <div className="flex gap-1.5">
          {Array.from({ length: RATING_MAX }, (_, i) => {
            const value = i + 1;
            return (
              <label key={value} className="press relative cursor-pointer rounded-full p-1 has-focus-visible:outline-3 has-focus-visible:outline-himbeere">
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={hearts === value}
                  onChange={() => setHearts(value)}
                  className="sr-only"
                  aria-label={`${value} ${value === 1 ? "Herz" : "Herzen"}`}
                />
                <HeartShape filled={value <= hearts} size={40} className={cn(value <= hearts && "animate-pop-in")} />
              </label>
            );
          })}
        </div>
        <p aria-live="polite" className="h-6 text-base font-semibold">
          {MOODS[hearts]}
        </p>
      </fieldset>
      {/* MFoto: "Nochmal machen?" */}
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-[15px] font-bold">Nochmal machen?</legend>
        <input type="hidden" name="again" value={again ?? ""} />
        <div className="grid grid-cols-3 gap-1.5">
          {AGAIN_ANSWERS.map((answer) => (
            <button
              key={answer}
              type="button"
              aria-pressed={again === answer}
              onClick={() => setAgain(again === answer ? null : answer)}
              className={cn("tap h-[46px] rounded-full text-[15px] font-semibold", again === answer ? "bg-ink text-bg" : "bg-soft text-ink")}
            >
              {AGAIN_LABEL[answer]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-bold">Was war besonders? (optional)</span>
        <textarea
          name="note"
          defaultValue={note ?? ""}
          maxLength={REVIEW_NOTE_MAX}
          rows={3}
          placeholder="Der Sonnenuntergang, das beste Eis der Stadt …"
          className="rounded-[18px] bg-soft px-4 py-3 placeholder:text-muted/70 focus:outline-2 focus:outline-himmel"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-bold">Was hat&apos;s ungefähr gekostet? (für euch beide, optional)</span>
        <span className="flex items-center gap-2">
          {/* Only a changed amount is saved – hearts alone must not turn the estimate into the real cost. */}
          <input type="hidden" name="costBefore" value={cost ?? ""} />
          <input
            name="cost"
            defaultValue={cost ?? ""}
            inputMode="decimal"
            placeholder="0"
            aria-label="Kosten in Euro"
            className="h-12 w-28 rounded-[18px] bg-soft px-4 font-semibold placeholder:text-muted/70"
          />
          <span className="font-bold">€</span>
        </span>
        <span className="text-xs text-muted">Zählt fürs Monatsbudget – ihr seht beide denselben Betrag.</span>
      </label>
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 font-bold text-tinte">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending || hearts === 0} className="w-full">
        {pending ? "Speichert …" : rating === null ? "Blatt speichern" : "Speichern"}
      </Button>
    </form>
  );
}
