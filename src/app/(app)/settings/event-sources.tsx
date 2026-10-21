"use client";

import { useActionState, useState, useTransition } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/button";
import {
  addCologneSourcesAction,
  addSourceAction,
  addSourcePageAction,
  refreshSourceAction,
  removeSourceAction,
  removeSourcePageAction,
  type SourceFormState,
} from "@/app/(app)/events/actions";

export type SourcePageView = {
  id: string;
  label: string;
  url: string;
  addedBy: "ai" | "user";
  status: string;
  tone: "ok" | "warn" | "new";
};

export type SourceView = {
  id: string;
  label: string;
  url: string;
  kind: "calendar" | "tips";
  /** "✓ 23 Einträge · vor 3 Std." / "⚠️ HTTP 403" / "Wird gelesen …" */
  status: string;
  tone: "ok" | "warn" | "busy" | "new";
  /** Listing pages read along with the start page. */
  pages: SourcePageView[];
  /** Sub-pages not picked yet (happens on the next read). */
  picking: boolean;
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
  // "Jetzt lesen" a second time within 10 minutes: say when it works again instead of doing nothing.
  const [wait, setWait] = useState<{ id: string; minutes: number } | null>(null);

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
                <button type="button" disabled={busy || source.tone === "busy"} className="underline disabled:opacity-50" onClick={() =>
                    startTransition(async () => {
                      const { waitMinutes } = await refreshSourceAction(source.id);
                      setWait(waitMinutes ? { id: source.id, minutes: waitMinutes } : null);
                    })
                  }
                >
                  Jetzt lesen
                </button>
                <ConfirmButton label="Entfernen" question="Die gelesenen Termine verschwinden mit." yes="Ja, entfernen" action={() => removeSourceAction(source.id)} />
              </div>
              {wait?.id === source.id && (
                <p role="status" className="text-sm font-bold text-muted">
                  Gerade erst gelesen – in {wait.minutes} {wait.minutes === 1 ? "Minute" : "Minuten"} wieder.
                </p>
              )}
              <SubPages source={source} />
            </li>
          ))}
        </ul>
      )}

      {/* A new key after each save empties the form. */}
      <form key={state.savedAt ?? 0} action={action} className="flex flex-col gap-2.5 border-t-[1.5px] border-track pt-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-extrabold">Weitere Seite</span>
          <input
            name="url"
            type="url"
            inputMode="url"
            required
            placeholder="https://…"
            className="h-12 rounded-[22px] bg-soft px-4 font-semibold placeholder:text-muted/70"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select name="kind" aria-label="Art der Seite" className="h-10 rounded-full bg-bg px-3 text-base font-extrabold">
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

/** The source's sub-pages, folded: status per page, remove, add one of the same site. */
function SubPages({ source }: { source: SourceView }) {
  const [state, action, pending] = useActionState<SourceFormState, FormData>(addSourcePageAction.bind(null, source.id), { status: "idle" });
  const [busy, startTransition] = useTransition();
  return (
    <details className="group/sub mt-1 rounded-2xl border-[1.5px] border-track">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-extrabold">
        <span>
          Unterseiten · {source.pages.length}
          {source.picking && source.pages.length === 0 && <span className="font-bold text-muted"> (werden beim Lesen gesucht)</span>}
        </span>
        <span aria-hidden="true" className="transition-transform group-open/sub:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t-[1.5px] border-track px-3 py-2.5">
        {source.pages.length === 0 && !source.picking && <p className="text-sm font-semibold text-muted">Keine – gelesen wird nur die Hauptseite (und ihre Seite 2).</p>}
        <ul className="flex flex-col gap-2">
          {source.pages.map((page) => (
            <li key={page.id} className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-extrabold underline decoration-2 underline-offset-2">
                  {page.label}
                </a>
                <span className={`self-start text-xs font-bold ${TONE[page.tone]}`}>
                  {page.status}
                  {page.addedBy === "ai" && " · von der KI"}
                </span>
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`${page.label} entfernen`}
                className="shrink-0 text-xs font-extrabold text-muted underline"
                onClick={() => startTransition(() => removeSourcePageAction(page.id))}
              >
                Entfernen
              </button>
            </li>
          ))}
        </ul>
        <form key={state.savedAt ?? 0} action={action} className="flex gap-2">
          <input
            name="url"
            type="url"
            inputMode="url"
            required
            aria-label={`Unterseite von ${source.label}`}
            placeholder={`${new URL(source.url).origin}/…`}
            className="h-10 min-w-0 flex-1 rounded-full bg-bg px-3.5 text-base font-semibold placeholder:text-muted/70"
          />
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            + Hinzufügen
          </Button>
        </form>
        {state.status === "error" && (
          <p role="alert" className="text-sm font-bold">
            {state.message}
          </p>
        )}
      </div>
    </details>
  );
}
