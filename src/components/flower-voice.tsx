"use client";

// The flower's thought bubble on the Beet. It also carries the one hint about reminders (no extra row):
// while my phone gets none it says so and a tap turns them on (or shows how to allow them); while the
// other one gets none it says that, and a tap hides it for a week.
import { useEffect, useRef, useState } from "react";
import { pushRow } from "@/core/push-nudge";
import { IosInstallGuide, PushDeniedHelp } from "./ios-install-guide";
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

const BUBBLE =
  "animate-pop-in absolute left-[-9.7%] top-[1.9%] z-10 w-[max(58.7%,150px)] -translate-x-[max(0px,calc(150px-58.7cqw))] -rotate-[4deg] rounded-[40px/34px] bg-ink px-[max(5.3cqw,12px)] pb-[max(5.3cqw,12px)] pt-[max(4.7cqw,10px)] text-center font-hand text-[max(7.67cqw,16px)] font-semibold leading-[1.02] text-bg";

/** What the bubble says and does: the thought, or the reminder hint (a tap turns push on / hides it). */
export type Voice = {
  words: string;
  hint: "mine" | "partner" | null;
  label?: string;
  pending?: boolean;
  onTap?: () => void;
  /** The how-to sheet (push blocked / iPhone browser) – render it once next to the bubble. */
  sheet: React.ReactNode;
};

export function useFlowerVoice({ text, publicKey, myDevices, partnerDevices, partnerName }: { text: string; publicKey: string | null; myDevices: number; partnerDevices: number; partnerName: string }): Voice {
  const push = usePush(publicKey);
  const sheet = useRef<SheetHandle>(null);
  // null until the browser is read: the server cannot know about the snooze.
  const [clock, setClock] = useState<{ snoozedAt: number | null; now: number } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage and the clock only exist in the browser
    setClock({ snoozedAt: readSnooze(), now: Date.now() });
  }, []);

  const known = clock !== null && push.support !== null && push.support !== "unsupported";
  const row = known ? pushRow({ configured: publicKey !== null, myDevices: myDevices + (push.subscription ? 1 : 0), partnerDevices, partnerSnoozedAt: clock.snoozedAt, now: clock.now }) : null;
  const denied = push.permission === "denied";
  const needsInstall = push.support === "ios-browser";
  const howTo = row === "mine" && (denied || needsInstall) && (
    <Sheet ref={sheet} title="Erinnerungen">
      {denied ? <PushDeniedHelp /> : <IosInstallGuide />}
    </Sheet>
  );

  if (row === "mine") {
    return {
      words: push.message && !denied ? push.message.toLowerCase() : denied ? "mein wecker ist blockiert – tipp mich an." : needsInstall ? "mein wecker geht erst als app – tipp mich an." : "mein wecker ist aus – tipp mich an.",
      hint: "mine",
      label: denied ? "So erlaubst du Erinnerungen" : needsInstall ? "So gehen Erinnerungen" : "Erinnerungen anschalten",
      pending: push.pending,
      onTap: () => (denied || needsInstall ? sheet.current?.open() : push.enable()),
      sheet: howTo,
    };
  }
  if (row === "partner") {
    return {
      words: `${partnerName.toLowerCase()} hört meinen wecker nicht – sag's weiter.`,
      hint: "partner",
      label: `${partnerName} bekommt keine Erinnerungen – eine Woche ausblenden`,
      onTap: () => {
        try {
          localStorage.setItem(SNOOZE_KEY, String(Date.now()));
        } catch {
          // storage unavailable – hides until the next visit
        }
        setClock({ snoozedAt: Date.now(), now: Date.now() });
      },
      sheet: null,
    };
  }
  return { words: text, hint: null, sheet: null };
}

/** The bubble itself: a button when it carries the reminder hint, else plain text. */
export function VoiceBubble({ voice, className, style }: { voice: Voice; className?: string; style?: React.CSSProperties }) {
  if (!voice.onTap) {
    return (
      <p data-speech className={className} style={style}>
        {voice.words}
      </p>
    );
  }
  return (
    <button type="button" data-speech data-push-hint={voice.hint ?? undefined} aria-label={voice.label} disabled={voice.pending} onClick={voice.onTap} className={className} style={style}>
      {voice.words}
    </button>
  );
}

/**
 * What the flower thinks (Caveat, a tilted oval) and two dots leading to its head – positions from
 * HomeB.html in the flower's 300×420 box; sizes in container units (cqw), so it scales with the flower –
 * but never below 16 px text: on a small phone the bubble keeps 150 px and grows to the left.
 */
export function FlowerVoice(props: { text: string; publicKey: string | null; myDevices: number; partnerDevices: number; partnerName: string }) {
  const voice = useFlowerVoice(props);
  return (
    <>
      <VoiceBubble voice={voice} className={BUBBLE} />
      <span aria-hidden="true" className="absolute left-[48.3%] top-[23.3%] size-[4.67cqw] rounded-full bg-ink" />
      <span aria-hidden="true" className="absolute left-[53.7%] top-[28.6%] size-[2.67cqw] rounded-full bg-ink" />
      {voice.sheet}
    </>
  );
}
