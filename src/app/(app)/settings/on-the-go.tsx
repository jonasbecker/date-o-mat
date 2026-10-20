"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/button";
import { createShareKeyAction, deleteShareKeyAction, saveStartLocationAction, type StartLocationState } from "./actions";

const inputClass = "h-12 w-full rounded-[22px] bg-soft px-4 font-bold text-ink placeholder:font-semibold placeholder:text-muted/70";

/** "Dein Startpunkt" for the route link on the date card. */
export function StartLocationForm({ value }: { value: string | null }) {
  const [state, action, pending] = useActionState<StartLocationState, FormData>(saveStartLocationAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="start-location" className="font-extrabold">
        Dein Startpunkt
      </label>
      <div className="flex gap-2">
        <input id="start-location" name="startLocation" defaultValue={value ?? ""} maxLength={120} placeholder="z. B. Ehrenfeld oder deine Straße" className={inputClass} />
        <Button type="submit" size="sm" disabled={pending} className="h-12 shrink-0">
          Speichern
        </Button>
      </div>
      <p className="text-sm font-semibold text-muted">
        Für „🗺️ Route“ beim nächsten Date (Google Maps mit Bus & Bahn). Leer = Maps nimmt deinen aktuellen Ort.
        {state.status === "saved" && " · Gespeichert ✓"}
      </p>
    </form>
  );
}

/** The personal key and the steps for the iPhone shortcut "Teilen → Date-O-Mat". */
export function ShareShortcut({ hasKey, endpoint }: { hasKey: boolean; endpoint: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">
        Auf dem iPhone steht die App nicht im Teilen-Menü – ein Kurzbefehl macht das: In TikTok, Instagram & Co. <strong>Teilen → Date-O-Mat</strong>, und die
        Idee landet direkt auf eurer Wunschliste.
      </p>
      {key ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-zitrone-soft p-3 text-tinte">
          <p className="text-sm font-extrabold">Dein Schlüssel (wird nur jetzt angezeigt):</p>
          <code className="break-all rounded-lg bg-white/70 px-2 py-1 text-xs">{key}</code>
          <Button size="sm" variant="secondary" onClick={() => copy("key", `Bearer ${key}`)} className="self-start">
            {copied === "key" ? "Kopiert ✓" : "„Bearer …“ kopieren"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={pending} onClick={() => start(async () => setKey((await createShareKeyAction()).key))}>
            {hasKey ? "Neuen Schlüssel erstellen" : "Schlüssel erstellen"}
          </Button>
          {hasKey && (
            <button type="button" onClick={() => start(() => deleteShareKeyAction())} className="text-sm font-extrabold text-muted underline">
              Schlüssel löschen
            </button>
          )}
          {hasKey && <span className="text-sm font-bold text-muted">✓ Ein Schlüssel ist aktiv.</span>}
        </div>
      )}
      <details className="rounded-2xl border-[1.5px] border-dashed border-track px-4 py-2">
        <summary className="cursor-pointer py-1 text-sm font-extrabold">So richtest du den Kurzbefehl ein (2 Minuten)</summary>
        <ol className="flex list-decimal flex-col gap-1.5 py-2 pl-5 text-sm font-semibold">
          <li>App „Kurzbefehle“ öffnen → <strong>+</strong> → oben den Namen auf <strong>Date-O-Mat</strong> setzen.</li>
          <li>
            Unten auf <strong>ⓘ</strong> → <strong>Im Share-Sheet anzeigen</strong> einschalten. Ganz oben bei „Empfängt“ nur <strong>URLs</strong> und{" "}
            <strong>Text</strong> lassen.
          </li>
          <li>
            Aktion <strong>Inhalte von URL abrufen</strong> hinzufügen. URL:{" "}
            <button type="button" onClick={() => copy("url", endpoint)} className="underline">
              {endpoint}
            </button>
            {copied === "url" && " ✓"}
          </li>
          <li>
            Dort auf „Mehr anzeigen“: Methode <strong>POST</strong>. Header hinzufügen: Schlüssel <strong>Authorization</strong>, Wert: deinen kopierten Text „Bearer
            dom_…“.
          </li>
          <li>
            Anfragetext <strong>JSON</strong> → Feld hinzufügen: Typ Text, Schlüssel <strong>text</strong>, Wert: die Variable <strong>Kurzbefehleingabe</strong>.
          </li>
          <li>
            Aktion <strong>Mitteilung anzeigen</strong> hinzufügen, Inhalt: <strong>Inhalte von URL</strong>. Fertig!
          </li>
        </ol>
        <p className="pb-2 text-xs font-bold text-muted">Der Schlüssel darf nur Ideen auf eure Wunschliste legen. Neu erstellen macht den alten ungültig.</p>
      </details>
    </div>
  );
}
