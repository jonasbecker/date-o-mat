"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { detectPushSupport, type PushSupport } from "./service-worker";

const DISMISS_KEY = "dom-push-nudge-dismissed";

/** Home screen hint: turn on reminders (or, on iPhone, install the app first). */
export function PushNudge({ subscribed }: { subscribed: boolean }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // storage unavailable (private mode) – just show the hint
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capabilities are only known on the client
    setDismissed(wasDismissed);
    setSupport(detectPushSupport());
  }, []);

  if (subscribed || dismissed || !support || support === "unsupported") return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-[20px] border-2 border-line bg-himmel/25 px-4 py-3.5">
      <span className="text-2xl leading-none" aria-hidden="true">
        {support === "ios-browser" ? "📲" : "🔔"}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-extrabold">
          {support === "ios-browser" ? "Hol dir den Date-O-Mat auf den Home-Bildschirm" : "Erinnerungen aktivieren"}
        </p>
        <p className="text-sm font-semibold">
          {support === "ios-browser"
            ? "Nur so kann dich das iPhone erinnern, wenn du dran bist."
            : "Damit du erfährst, wenn du dran bist oder ein Date ansteht."}{" "}
          <Link href="/settings#push" className="font-extrabold underline">
            So geht&apos;s
          </Link>
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Hinweis ausblenden" className="text-lg font-extrabold text-muted">
        ×
      </button>
    </div>
  );
}
