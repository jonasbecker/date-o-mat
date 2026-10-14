"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/button";
import { addCologneSourcesAction, addSourceAction, refreshSourceAction, removeSourceAction, type SourceFormState } from "@/app/(app)/events/actions";

export type SourceView = {
  id: string;
  label: string;
  url: string;
  kind: "calendar" | "tips";
  /** "✓ 23 Einträge · vor 3 Std." / "⚠️ HTTP 403" / "Wird gelesen …" */
  status: string;
  tone: "ok" | "warn" | "busy" | "new";
};

const TONE = {
  ok: "text-ink",
  warn: "rounded-lg bg-zitrone-soft px-2 py-0.5 text-tinte",
  busy: "text-muted animate-pulse",
  new: "text-muted",
} as const;

export function EventSources({ sources, aiReady }: { sources: SourceView[]; aiReady: boolean }) {
  const [state, action, pending] = useActionState<SourceFormState, FormData>(addSourceAction, { status: "idle" });
  const [busy, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {!aiReady && (
        <p className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
          Claude ist noch nicht eingerichtet (ANTHROPIC_API_KEY fehlt). Nur Seiten mit eingebauten Event-Daten können gelesen werden – siehe docs/SETUP.md.
        </p>
      )}

      {sources.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-semibold">Der Date-O-Mat liest jeden Morgen eure Lieblings-Seiten und zeigt unter „Was läuft“, wann ihr beide Zeit habt.</p>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => startTransition(() => addCologneSourcesAction())} className="self-start">
            Köln-Quellen hinzufügen
          </Button>
          <p className="text-[13px] font-bold text-muted">rausgegangen, koeln.de, KölnTourismus und Mit Vergnügen</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y-2 divide-track">
          {sources.map((source) => (
            <li key={source.id} className="flex flex-col gap-1 py-2.5 first:pt-0">
              <div className="flex items-center justify-between gap-2">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="truncate font-extrabold underline decoration-2 underline-offset-2">
                  {source.label}
                </a>
                <span className="shrink-0 text-xs font-extrabold text-muted">{source.kind === "tips" ? "Tipps" : "Kalender"}</span>
              </div>
              <p className={`self-start text-sm font-bold ${TONE[source.tone]}`}>{source.status}</p>
              <div className="flex gap-4 text-sm font-extrabold">
                <button type="button" disabled={busy || source.tone === "busy"} className="underline disabled:opacity-50" onClick={() => startTransition(() => refreshSourceAction(source.id))}>
                  Jetzt lesen
                </button>
                <button type="button" disabled={busy} className="text-muted underline" onClick={() => startTransition(() => removeSourceAction(source.id))}>
                  Entfernen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* A new key after each save empties the form. */}
      <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-2.5 border-t-2 border-track pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-extrabold">Weitere Seite</span>
          <input
            name="url"
            type="url"
            inputMode="url"
            required
            placeholder="https://…"
            className="h-12 rounded-[16px] border-2 border-line bg-bg px-4 font-semibold placeholder:text-muted/70"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select name="kind" aria-label="Art der Seite" className="h-10 rounded-full border-2 border-line bg-bg px-3 text-sm font-extrabold">
            <option value="calendar">Veranstaltungskalender</option>
            <option value="tips">Tipps &amp; Artikel</option>
          </select>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Fügt hinzu …" : "Hinzufügen"}
          </Button>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm font-bold">
            {state.message}
          </p>
        )}
        <p className="text-[13px] font-semibold text-muted">
          Seiten, die ihre Termine erst per JavaScript nachladen, lassen sich evtl. nicht lesen – das steht dann hier.
        </p>
      </form>
    </div>
  );
}
