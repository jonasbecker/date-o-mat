"use client";

import { Banner } from "./banner";
import { BANNERS, MOTIFS } from "@/core/banners";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { IdeaFormState } from "@/app/(app)/ideas/actions";
import { analyzeLinkAction } from "@/app/(app)/ideas/link-actions";
import type { Platform } from "@/core/link-idea";
import { cn } from "@/lib/cn";
import { CATEGORY_LABEL, IDEA_CATEGORIES, type IdeaCategory } from "@/core/categories";
import { IDEA_SIZES, type IdeaSize, type PlaceSetting } from "@/lib/domain";
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
  setting?: PlaceSetting | null;
  category?: IdeaCategory | null;
  /** Its banner (core/banners.ts); empty = picked from its words. */
  motif?: string | null;
};

type Action = (prev: IdeaFormState, formData: FormData) => Promise<IdeaFormState>;

const FROM: Record<Platform, string> = { tiktok: "aus dem TikTok", youtube: "aus dem YouTube-Video", instagram: "aus dem Instagram-Post", web: "von der Webseite" };
const PLAIN_REASON = {
  off: "Titel aus dem Link übernommen – passt ihn ruhig an.",
  limit: "KI-Limit für heute erreicht – Titel aus dem Link übernommen.",
  failed: "Die KI hat gerade nicht geantwortet – Titel aus dem Link übernommen.",
};

/** A first http(s) link in pasted text (kept in sync with extractUrl in core/link-idea). */
function pastedLink(text: string): boolean {
  return /https?:\/\/\S{3,}/i.test(text);
}

const inputClass =
  "w-full rounded-[22px] bg-soft px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70 focus:shadow-[0_0_0_4px_var(--color-himbeere-soft)] focus:outline-none";

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
  initialLink,
  initialTitle,
}: {
  action: Action;
  idea?: IdeaFormDefaults;
  onSaved: () => void;
  onDelete?: () => Promise<void>;
  footnote?: string;
  /** Shared into the app: analyze this link right away. */
  initialLink?: string;
  /** Typed into the field on the ideas page: a new idea starts with this title. */
  initialTitle?: string;
}) {
  const [state, formAction, pending] = useActionState<IdeaFormState, FormData>(async (prev, formData) => {
    const result = await action(prev, formData);
    if (result.status === "saved") onSaved();
    return result;
  }, { status: "idle" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  // Link → Idee (new ideas only): a pasted or shared link becomes a prefilled draft.
  const [draft, setDraft] = useState<IdeaFormDefaults | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [importInfo, setImportInfo] = useState<{ text: string; ai: boolean } | null>(null);
  const [importing, startImport] = useTransition();
  const canImport = !idea?.id;

  function importLink(text: string) {
    startImport(async () => {
      const result = await analyzeLinkAction(text).catch(() => null);
      if (result?.ok) {
        setDraft({ ...result.draft });
        setImportInfo(
          result.via === "ai"
            ? { ai: true, text: `✨ Idee ${FROM[result.platform]} – kurz prüfen, dann speichern.` }
            : { ai: false, text: PLAIN_REASON[result.reason ?? "off"] },
        );
      } else {
        setDraft({ title: "", size: "small", note: null, url: result?.url ?? null, costEur: null, location: null });
        setImportInfo({
          ai: false,
          text: result?.error === "invalid" ? "Das sieht nicht nach einem Link aus." : "Den Link konnten wir nicht lesen – schreib kurz, was ihr machen wollt. Der Link ist schon eingetragen.",
        });
      }
      setDraftKey((key) => key + 1);
    });
  }

  const started = useRef(false);
  useEffect(() => {
    if (!initialLink || started.current) return;
    started.current = true;
    importLink(initialLink);
  });

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (pastedLink(text)) return importLink(text);
      setImportInfo({ ai: false, text: "In der Zwischenablage ist kein Link." });
    } catch {
      setImportInfo({ ai: false, text: "Halte im Titelfeld gedrückt und wähle „Einsetzen“." });
    }
  }

  // After a failed submit, show what was typed; otherwise the draft, the idea (or empty).
  const base = draft ?? idea ?? (initialTitle ? { title: initialTitle, size: "small" as IdeaSize, note: null, url: null, costEur: null, location: null } : undefined);
  const typed = state.status === "error" ? state.values : undefined;
  const value = (field: keyof IdeaFormDefaults) => typed?.[field] ?? (base?.[field] == null ? "" : String(base[field]));
  const size = (typed?.size as IdeaSize | undefined) ?? base?.size ?? "small";
  const errors = state.errors ?? {};
  const detailsOpen = Boolean(
    value("note") || value("url") || value("costEur") || value("location") || value("setting") || value("category") || errors.note || errors.url || errors.costEur || errors.location,
  );
  const idPrefix = idea?.id ?? "new";

  return (
    <form key={draftKey} action={formAction} inert={importing} aria-busy={importing} className={cn("flex flex-col gap-4", importing && "opacity-60")}>
      {idea?.id && <input type="hidden" name="id" value={idea.id} />}

      {(importing || importInfo) && (
        <p role="status" className={cn("rounded-2xl px-4 py-2.5 text-sm font-bold", importInfo?.ai && !importing ? "bg-minze text-tinte" : "bg-track/60")}>
          {importing ? "🔍 Schaue mir den Link an …" : importInfo?.text}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={`${idPrefix}-title`} className="text-[13px] font-extrabold text-muted">
            Was wollt ihr machen?
          </label>
          {canImport && (
            <button type="button" onClick={pasteFromClipboard} className="text-[13px] font-extrabold text-muted underline">
              🔗 Link einfügen
            </button>
          )}
        </div>
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
          aria-describedby={errors.title ? `${idPrefix}-title-error` : canImport ? `${idPrefix}-title-hint` : undefined}
          className={cn(inputClass, "h-14 text-lg")}
          onPaste={(event) => {
            if (!canImport || event.currentTarget.value.trim()) return;
            const text = event.clipboardData.getData("text");
            if (!pastedLink(text)) return;
            event.preventDefault();
            importLink(text);
          }}
        />
        <FieldError id={`${idPrefix}-title-error`} message={errors.title} />
        {canImport && !errors.title && !importInfo && (
          <p id={`${idPrefix}-title-hint`} className="text-xs font-bold text-muted">
            Tipp: Link von TikTok, Instagram, YouTube oder einer Webseite einfügen – daraus wird eine Idee.
          </p>
        )}
      </div>

      <fieldset className="grid grid-cols-2 gap-2.5">
        <legend className="sr-only">Größe</legend>
        {IDEA_SIZES.map((option) => (
          <label
            key={option}
            className={cn(
              "flex h-[52px] cursor-pointer items-center justify-center gap-1.5 rounded-[22px] bg-soft font-display text-[17px] font-semibold transition-colors",
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

      <details open={detailsOpen} className="group rounded-2xl border-[1.5px] border-dashed border-track px-4 py-2">
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
          {/* Outdoors the free times look at daylight and weather. */}
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[13px] font-extrabold text-muted">Wo?</legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "", label: "Egal" },
                { value: "indoor", label: "🏠 Drinnen" },
                { value: "outdoor", label: "🌳 Draußen" },
              ].map((option) => (
                <label
                  key={option.value}
                  className="flex h-11 cursor-pointer items-center justify-center rounded-[22px] bg-soft text-sm font-extrabold has-checked:bg-ink has-checked:text-bg has-focus-visible:outline-3 has-focus-visible:outline-himbeere"
                >
                  <input type="radio" name="setting" value={option.value} defaultChecked={(value("setting") || "") === option.value} className="sr-only" />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          {/* Left empty, the wishlist guesses from the words. */}
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[13px] font-extrabold text-muted">Was für ein Date?</legend>
            <div className="flex flex-wrap gap-2">
              {[{ value: "", label: "Automatisch" }, ...IDEA_CATEGORIES.map((c) => ({ value: c, label: `${CATEGORY_LABEL[c].emoji} ${CATEGORY_LABEL[c].label}` }))].map((option) => (
                <label
                  key={option.value}
                  className="flex h-10 cursor-pointer items-center justify-center rounded-full bg-surface px-3 text-sm font-extrabold has-checked:bg-ink has-checked:text-bg has-focus-visible:outline-3 has-focus-visible:outline-himbeere"
                >
                  <input type="radio" name="category" value={option.value} defaultChecked={(value("category") || "") === option.value} className="sr-only" />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          {/* The banner on its card: a row of small scenes, scrolling sideways. */}
          <fieldset className="flex min-w-0 flex-col gap-1">
            <legend className="mb-1 text-[13px] font-extrabold text-muted">Bild auf der Karte</legend>
            <div data-motif-row className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {["", ...MOTIFS].map((motif) => (
                <label
                  key={motif}
                  title={motif ? BANNERS[motif].name : "Automatisch"}
                  className="flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-[12px] p-1 text-[11px] font-bold has-checked:bg-ink has-checked:text-bg has-focus-visible:outline-3 has-focus-visible:outline-himbeere"
                >
                  <input type="radio" name="motif" value={motif} defaultChecked={(value("motif") || "") === motif} aria-label={motif ? BANNERS[motif].name : "Automatisch"} className="sr-only" />
                  {motif ? (
                    <Banner motiv={motif} hoehe={28} breite={88} className="rounded-[8px]" />
                  ) : (
                    <span className="flex h-7 w-[88px] items-center justify-center rounded-[8px] bg-soft">✨ Auto</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
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
