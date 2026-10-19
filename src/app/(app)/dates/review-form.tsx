"use client";

import { useActionState, useState } from "react";
import { HeartShape } from "@/components/hearts";
import { Button } from "@/components/button";
import { useCelebrate } from "@/components/celebration";
import { cn } from "@/lib/cn";
import { RATING_MAX, REVIEW_NOTE_MAX } from "@/lib/domain";
import { saveReviewAction, type ReviewFormState } from "./actions";

const MOODS = ["", "Naja 😕", "Ganz okay 🙂", "Schön 😊", "Richtig schön 🥰", "Unvergesslich 🤩"];

export function ReviewForm({ dateId, rating, note, cost, initialHearts = 0 }: { dateId: string; rating: number | null; note: string | null; cost: number | null; /** From a tap on a heart on the start page. */ initialHearts?: number }) {
  const celebrate = useCelebrate();
  const [hearts, setHearts] = useState(rating ?? initialHearts);
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
      <button type="button" onClick={() => setEditing(true)} className="self-start text-sm font-extrabold text-muted underline">
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
                <HeartShape filled={value <= hearts} size={44} className={cn(value <= hearts && "animate-pop-in")} />
              </label>
            );
          })}
        </div>
        <p aria-live="polite" className="h-6 font-display text-lg font-semibold">
          {MOODS[hearts]}
        </p>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="font-extrabold">Was war besonders? (optional)</span>
        <textarea
          name="note"
          defaultValue={note ?? ""}
          maxLength={REVIEW_NOTE_MAX}
          rows={3}
          placeholder="Der Sonnenuntergang, das beste Eis der Stadt …"
          className="rounded-[18px] border-2 border-line bg-bg px-4 py-3 font-semibold placeholder:text-muted/70"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-extrabold">Was hat&apos;s ungefähr gekostet? (für euch beide, optional)</span>
        <span className="flex items-center gap-2">
          <input
            name="cost"
            defaultValue={cost ?? ""}
            inputMode="decimal"
            placeholder="0"
            aria-label="Kosten in Euro"
            className="h-12 w-28 rounded-[18px] border-2 border-line bg-bg px-4 font-bold placeholder:text-muted/70"
          />
          <span className="font-bold">€</span>
        </span>
        <span className="text-xs font-bold text-muted">Zählt fürs Monatsbudget – ihr seht beide denselben Betrag.</span>
      </label>
      {state.status === "error" && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 font-bold text-tinte">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending || hearts === 0} className="w-full">
        {pending ? "Speichert …" : rating === null ? "Bewertung abschicken" : "Speichern"}
      </Button>
    </form>
  );
}
