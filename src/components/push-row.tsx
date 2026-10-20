"use client";

import { useEffect, useRef, useState } from "react";
import { pushRow } from "@/core/push-nudge";
import { IosInstallGuide, PushDeniedHelp } from "./ios-install-guide";
import { BellIcon } from "./icons";
import { Sheet, type SheetHandle } from "./sheet";
import { usePush } from "./use-push";

const SNOOZE_KEY = "dom-partner-push-snoozed";

function readSnooze(): number | null {
  try {
    const value = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/**
 * The start page's one line about reminders. Mine stays until a device of mine is
 * registered (one tap turns them on, no detour through the settings); the line about the
 * other person can be snoozed for a week.
 */
export function PushRow({ publicKey, myDevices, partnerDevices, partnerName }: { publicKey: string | null; myDevices: number; partnerDevices: number; partnerName: string }) {
  const push = usePush(publicKey);
  const sheet = useRef<SheetHandle>(null);
  // null until the browser is read: the server cannot know about the snooze.
  const [clock, setClock] = useState<{ snoozedAt: number | null; now: number } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage and the clock only exist in the browser
    setClock({ snoozedAt: readSnooze(), now: Date.now() });
  }, []);

  if (!clock || push.support === null) return null;
  // Something registered here a moment ago: the server data is only refreshed afterwards.
  const registered = myDevices + (push.subscription ? 1 : 0);
  const row = pushRow({ configured: publicKey !== null, myDevices: registered, partnerDevices, partnerSnoozedAt: clock.snoozedAt, now: clock.now });
  if (row === null) return null;

  if (row === "partner") {
    return (
      <p role="note" className="flex items-center gap-2.5 rounded-[18px] border-[1.5px] border-dashed border-line px-3.5 py-2 text-sm">
        <BellIcon width={18} height={18} className="shrink-0" />
        <span className="min-w-0 flex-1">{partnerName} bekommt keine Erinnerungen – sag Bescheid.</span>
        <button
          type="button"
          aria-label="Eine Woche ausblenden"
          onClick={() => {
            try {
              localStorage.setItem(SNOOZE_KEY, String(Date.now()));
            } catch {
              // storage unavailable – hides until the next visit
            }
            setClock({ snoozedAt: Date.now(), now: Date.now() });
          }}
          className="shrink-0 text-base font-bold text-muted"
        >
          ×
        </button>
      </p>
    );
  }

  const denied = push.permission === "denied";
  const needsInstall = push.support === "ios-browser";
  const unsupported = push.support === "unsupported";
  if (unsupported) return null;
  return (
    <>
      <div role="note" className="flex items-center gap-2.5 rounded-[18px] bg-surface px-3.5 py-2 text-sm font-medium">
        <BellIcon width={18} height={18} className="shrink-0" />
        <span className="min-w-0 flex-1 leading-tight">
          {denied ? "Erinnerungen sind blockiert." : needsInstall ? "Erinnerungen gehen erst als App." : "Damit ihr kein Date vergesst: Erinnerungen an."}
          {push.message && !denied && (
            <span role="status" className="block text-[13px] text-muted">
              {push.message}
            </span>
          )}
        </span>
        {denied || needsInstall ? (
          <button type="button" onClick={() => sheet.current?.open()} className="shrink-0 rounded-full border-[1.5px] border-ink px-3 py-1 font-bold text-ink">
            {denied ? "So erlaubst du sie" : "So geht's"}
          </button>
        ) : (
          <button type="button" onClick={push.enable} disabled={push.pending} className="press shrink-0 rounded-full bg-ink px-3.5 py-1.5 font-bold text-bg disabled:opacity-60">
            Aktivieren
          </button>
        )}
      </div>
      <Sheet ref={sheet} title="Erinnerungen">
        {denied ? <PushDeniedHelp /> : <IosInstallGuide />}
      </Sheet>
    </>
  );
}
