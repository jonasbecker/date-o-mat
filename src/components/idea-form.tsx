"use client";

import { useActionState, useState, useTransition } from "react";
import type { IdeaFormState } from "@/app/(app)/ideas/actions";
import { cn } from "@/lib/cn";
import { IDEA_SIZES, type IdeaSize } from "@/lib/domain";
import { IDEA_LIMITS } from "@/lib/idea-input";
import { Button } from "./button";
import { SIZE_LABEL } from "./size-chip";

export type IdeaFormDefaults = {
  id?: string;
  title: string;
  size: IdeaSize;
  note: string | null;
  url: string | null;
  costEur: number | null;
  location: string | null;
};

type Action = (prev: IdeaFormState, formData: FormData) => Promise<IdeaFormState>;

const inputClass =
  "w-full rounded-2xl border-[2.5px] border-line bg-surface px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70 focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-bold text-ink">
      {message}
    </p>
  );
}

/**
 * Create/edit form for wishlist ideas. Title + size are enough; everything
 * else hides behind "Mehr Details" so an idea is captured in a few seconds.
 */
export function IdeaForm({
  action,
  idea,
  onSaved,
  onDelete,
  footnote,
}: {
  action: Action;
  idea?: IdeaFormDefaults;
  onSaved: () => void;
  onDelete?: () => Promise<void>;
  footnote?: string;
}) {
  const [state, formAction, pending] = useActionState<IdeaFormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.status === "saved") onSaved();
    return result;
  }, { status: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  // After a failed submit, show what was typed; otherwise the idea (or empty).
  const typed = state.status === "error" ? state.values : undefined;
  const value = (field: keyof IdeaFormDefaults) => typed?.[field] ?? (idea?.[field] == null ? "" : String(idea[field]));
  const size = (typed?.size as IdeaSize | undefined) ?? idea?.size ?? "small";
  const errors = state.errors ?? {};
  const detailsOpen = Boolean(
    value("note") || value("url") || value("costEur") || value("location") || errors.note || errors.url || errors.costEur || errors.location,
  );
  const idPrefix = idea?.id ?? "new";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {idea?.id && <input type="hidden" name="id" value={idea.id} />}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-title`} className="text-[13px] font-extrabold text-muted">
          Was wollt ihr machen?
        </label>
        <input
          id={`${idPrefix}-title`}
          name="title"
          defaultValue={value("title")}
          data-autofocus
          required
          maxLength={IDEA_LIMITS.title}
          placeholder="z. B. Picknick im Stadtwald"
          enterKeyHint="done"
          autoComplete="off"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? `${idPrefix}-title-error` : undefined}
          className={cn(inputClass, "h-14 text-lg")}
        />
        <FieldError id={`${idPrefix}-title-error`} message={errors.title} />
      </div>

      <fieldset className="grid grid-cols-2 gap-2.5">
        <legend className="sr-only">Größe</legend>
        {IDEA_SIZES.map((option) => (
          <label
            key={option}
            className={cn(
              "flex h-[52px] cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-[2.5px] border-line bg-surface font-display text-[17px] font-semibold transition-colors",
              "has-checked:text-tinte has-checked:shadow-[3px_3px_0_var(--line)] has-focus-visible:outline-3 has-focus-visible:outline-himbeere",
              option === "small" ? "has-checked:bg-zitrone" : "has-checked:bg-lavendel",
            )}
          >
            <input type="radio" name="size" value={option} defaultChecked={size === option} className="sr-only" />
            <span aria-hidden="true">{SIZE_LABEL[option].emoji}</span>
            {SIZE_LABEL[option].label}
          </label>
        ))}
      </fieldset>

      <details open={detailsOpen} className="group rounded-2xl border-2 border-dashed border-track px-4 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between py-1.5 text-sm font-extrabold text-muted">
          Mehr Details: Notiz, Link, Kosten, Ort
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-open:rotate-180">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="flex flex-col gap-3 pb-2 pt-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idPrefix}-note`} className="text-[13px] font-extrabold text-muted">
              Notiz
            </label>
            <textarea
              id={`${idPrefix}-note`}
              name="note"
              defaultValue={value("note")}
              rows={2}
              maxLength={IDEA_LIMITS.note}
              placeholder="z. B. Decke mitnehmen"
              className={cn(inputClass, "py-3")}
            />
            <FieldError id={`${idPrefix}-note-error`} message={errors.note} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${idPrefix}-url`} className="text-[13px] font-extrabold text-muted">
              Link
            </label>
            <input
              id={`${idPrefix}-url`}
              name="url"
              defaultValue={value("url")}
              inputMode="url"
              autoComplete="off"
              placeholder="z. B. kino.de/…"
              aria-invalid={errors.url ? true : undefined}
              className={cn(inputClass, "h-12")}
            />
            <FieldError id={`${idPrefix}-url-error`} message={errors.url} />
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idPrefix}-cost`} className="text-[13px] font-extrabold text-muted">
                Kosten (€)
              </label>
              <input
                id={`${idPrefix}-cost`}
                name="costEur"
                defaultValue={value("costEur")}
                inputMode="decimal"
                placeholder="0"
                aria-invalid={errors.costEur ? true : undefined}
                className={cn(inputClass, "h-12")}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${idPrefix}-location`} className="text-[13px] font-extrabold text-muted">
                Ort
              </label>
              <input
                id={`${idPrefix}-location`}
                name="location"
                defaultValue={value("location")}
                maxLength={IDEA_LIMITS.location}
                placeholder="z. B. Rheinufer"
                className={cn(inputClass, "h-12")}
              />
            </div>
          </div>
          <FieldError id={`${idPrefix}-cost-error`} message={errors.costEur} />
          <FieldError id={`${idPrefix}-location-error`} message={errors.location} />
        </div>
      </details>

      {state.message && (
        <p role="alert" className="font-bold">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending || deleting} className="h-[58px] text-xl">
        {pending ? "Speichert …" : "Speichern"}
      </Button>

      {onDelete &&
        (confirmDelete ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-himbeere-soft px-4 py-3 text-tinte">
            <span className="font-bold">Wirklich löschen?</span>
            <span className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                Nein
              </Button>
              <Button size="sm" disabled={deleting} onClick={() => startDelete(onDelete)}>
                Ja, löschen
              </Button>
            </span>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="self-center text-sm font-extrabold text-muted underline">
            Idee löschen
          </button>
        ))}

      {footnote && <p className="text-center text-xs font-bold text-muted">{footnote}</p>}
    </form>
  );
}
