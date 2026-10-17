"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { genitive } from "@/lib/format";
import { connectCalendarHref } from "./connect-calendar";
import { detectPushSupport } from "./service-worker";

const DISMISS_KEY = "dom-setup-dismissed";

type Item = { key: string; done: boolean; label: string; todo: string; hint?: React.ReactNode };

/**
 * "Startklar?" – what is still missing for the app to work well on this phone.
 * Disappears once everything is done (or when dismissed).
 */
export function SetupChecklist({
  calendar,
  partnerName,
  partnerCalendar,
  pushOn,
}: {
  calendar: boolean;
  partnerName: string;
  partnerCalendar: boolean;
  pushOn: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [env, setEnv] = useState<{ phone: boolean; installed: boolean; ios: boolean; dismissed: boolean } | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // storage unavailable – show the list
    }
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device facts are only known in the browser
    setEnv({
      phone: window.matchMedia("(pointer: coarse)").matches,
      installed,
      ios: detectPushSupport() === "ios-browser" || /iPhone|iPad|iPod/.test(navigator.userAgent),
      dismissed,
    });
  }, []);

  if (!env || env.dismissed) return null;

  const items: Item[] = [
    {
      key: "calendar",
      done: calendar,
      label: "Dein Kalender ist verbunden",
      todo: "Verbinde deinen Kalender",
      hint: (
        <a href={connectCalendarHref("/")} className="underline">
          Jetzt verbinden
        </a>
      ),
    },
    { key: "partner", done: partnerCalendar, label: `${genitive(partnerName)} Kalender ist verbunden`, todo: `${genitive(partnerName)} Kalender fehlt noch`, hint: `${partnerName} verbindet ihn in der App unter „Date planen“.` },
  ];
  if (env.phone) {
    items.push({
      key: "install",
      done: env.installed,
      label: "Date-O-Mat liegt auf dem Home-Bildschirm",
      todo: "Leg den Date-O-Mat auf den Home-Bildschirm",
      hint: env.ios ? "Safari: Teilen-Symbol → „Zum Home-Bildschirm“ → Hinzufügen. Danach die App über das Icon öffnen." : "Browser-Menü (⋮) → „App installieren“ oder „Zum Startbildschirm hinzufügen“.",
    });
  }
  items.push({
    key: "push",
    done: pushOn,
    label: "Erinnerungen sind an",
    todo: "Schalte die Erinnerungen an",
    hint:
      env.ios && !env.installed ? (
        "Auf dem iPhone geht das erst, wenn die App auf dem Home-Bildschirm liegt."
      ) : (
        <Link href="/settings?t=push" className="underline">
          In den Einstellungen aktivieren
        </Link>
      ),
  });

  const open = items.filter((item) => !item.done);
  if (open.length === 0) return null;

  function dismiss() {
    setEnv((current) => current && { ...current, dismissed: true });
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  // One line: the next thing that is missing – "›" shows the one after (the start page is one screen).
  const next = open[shown % open.length];
  return (
    <section aria-label={`Startklar? ${items.length - open.length} von ${items.length}`} className="flex items-start gap-2.5 rounded-[18px] border-2 border-dashed border-line px-3.5 py-2 text-sm">
      <span className="shrink-0 font-extrabold">
        Startklar {items.length - open.length}/{items.length}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{next.todo}</span>
        {next.hint && <span className="block font-semibold text-muted">{next.hint}</span>}
      </span>
      {open.length > 1 && (
        <button type="button" onClick={() => setShown((i) => i + 1)} aria-label="Nächster Punkt" className="shrink-0 text-base font-extrabold">
          ›
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Ausblenden" className="shrink-0 text-base font-extrabold text-muted">
        ×
      </button>
    </section>
  );
}
