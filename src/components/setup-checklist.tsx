"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { genitive } from "@/lib/format";
import { connectCalendarHref } from "./connect-calendar";
import { detectPushSupport } from "./service-worker";

const DISMISS_KEY = "dom-setup-dismissed";

type Item = { key: string; done: boolean; label: string; hint?: React.ReactNode };

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
      hint: (
        <a href={connectCalendarHref("/")} className="underline">
          Jetzt verbinden
        </a>
      ),
    },
    { key: "partner", done: partnerCalendar, label: `${genitive(partnerName)} Kalender ist verbunden`, hint: `${partnerName} verbindet ihn in der App unter „Date planen“.` },
  ];
  if (env.phone) {
    items.push({
      key: "install",
      done: env.installed,
      label: "Date-O-Mat liegt auf dem Home-Bildschirm",
      hint: env.ios ? "Safari: Teilen-Symbol → „Zum Home-Bildschirm“ → Hinzufügen. Danach die App über das Icon öffnen." : "Browser-Menü (⋮) → „App installieren“ oder „Zum Startbildschirm hinzufügen“.",
    });
  }
  items.push({
    key: "push",
    done: pushOn,
    label: "Erinnerungen sind an",
    hint:
      env.ios && !env.installed ? (
        "Auf dem iPhone geht das erst, wenn die App auf dem Home-Bildschirm liegt."
      ) : (
        <Link href="/settings#push" className="underline">
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

  return (
    <section aria-labelledby="setup-heading" className="flex flex-col gap-3 rounded-[22px] border-[2.5px] border-dashed border-line px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="setup-heading" className="text-[17px] font-semibold">
          Startklar? {items.length - open.length} von {items.length}
        </h2>
        <button type="button" onClick={dismiss} className="text-[13px] font-extrabold text-muted underline">
          Ausblenden
        </button>
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-xs font-extrabold",
                item.done ? "bg-minze text-tinte" : "bg-surface",
              )}
            >
              {item.done ? "✓" : ""}
            </span>
            <span className="flex flex-col">
              <span className={cn("font-bold", item.done && "text-muted line-through decoration-2")}>{item.label}</span>
              {!item.done && item.hint && <span className="text-sm font-semibold text-muted">{item.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
