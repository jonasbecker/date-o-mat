"use client";

import { useEffect, useState } from "react";
import { deniedHelp, type DeniedHelp } from "@/core/push-nudge";

/** Step-by-step: push on iPhone only works for apps on the home screen. */
export function IosInstallGuide() {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border-2 border-line bg-zitrone-soft p-4 text-left text-tinte">
      <p className="font-display text-lg font-semibold">📲 Erst auf den Home-Bildschirm</p>
      <p className="text-sm font-semibold">Auf dem iPhone gibt es Push nur, wenn der Date-O-Mat als App installiert ist (ab iOS 16.4):</p>
      <ol className="flex flex-col gap-2 text-sm font-bold">
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tinte text-xs text-zitrone-soft">1</span>
          In Safari unten auf
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Teilen">
            <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
          „Teilen“ tippen
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tinte text-xs text-zitrone-soft">2</span>
          „Zum Home-Bildschirm“ wählen
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tinte text-xs text-zitrone-soft">3</span>
          Den Date-O-Mat über das neue Icon öffnen
        </li>
        <li className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tinte text-xs text-zitrone-soft">4</span>
          Dort die Erinnerungen aktivieren
        </li>
      </ol>
    </div>
  );
}

/** The browser said no to notifications: how to allow them again on this device. */
export function PushDeniedHelp() {
  const [help, setHelp] = useState<DeniedHelp | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device is only known in the browser
    setHelp(deniedHelp(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  return (
    <div role="note" className="flex flex-col gap-2 rounded-[20px] border-2 border-line bg-zitrone-soft p-4 text-left text-tinte">
      <p className="font-display text-lg font-semibold">🔕 Erinnerungen sind blockiert</p>
      <p className="text-sm font-semibold">Du hast Benachrichtigungen abgelehnt. So erlaubst du sie wieder:</p>
      {help && (
        <ol className="list-decimal pl-5 text-sm font-bold">
          {help.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
