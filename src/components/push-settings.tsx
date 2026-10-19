"use client";

import { useState, useTransition } from "react";
import { sendTestPushAction, setNotificationPrefAction } from "@/app/(app)/settings/actions";
import { cn } from "@/lib/cn";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/domain";
import { Button } from "./button";
import { IosInstallGuide, PushDeniedHelp } from "./ios-install-guide";
import { usePush } from "./use-push";

export function PushSettings({
  publicKey,
  prefs: initialPrefs,
  partnerName,
}: {
  publicKey: string | null;
  prefs: Record<NotificationType, boolean>;
  partnerName: string;
}) {
  const { support, permission, subscription, message, setMessage, pending: pushPending, enable, disable } = usePush(publicKey);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [testPending, startTransition] = useTransition();
  const pending = pushPending || testPending;

  function test() {
    startTransition(async () => {
      const { delivered } = await sendTestPushAction();
      setMessage(delivered > 0 ? "Test-Push ist unterwegs." : "Kein Gerät hat den Push angenommen.");
    });
  }

  function toggle(type: NotificationType) {
    const enabled = !prefs[type];
    setPrefs({ ...prefs, [type]: enabled });
    startTransition(() => setNotificationPrefAction(type, enabled));
  }

  const labels: Record<NotificationType, string> = {
    turn_started: "Du bist dran (ab 9 Uhr)",
    deadline_soon: "„Plan bis“ naht (24 Std. vorher)",
    partner_activity: `${partnerName} plant, bestätigt oder sagt ab`,
    date_tomorrow: "Date ist morgen (19 Uhr am Vortag)",
    date_soon: "Date in 2 Stunden",
    review_due: "Wie war's? (am Tag nach dem Date)",
    system: "Wichtiges (z. B. ein Kalender wurde getrennt)",
    match: "Match! – ihr mögt beide dieselbe Idee",
    deck_nudge: `Swipen: ${partnerName} hat Ideen geliked oder super-geliked`,
    budget: "Monatsrückblick: Budget und Spartopf",
    special_day: "Besondere Tage (2 Wochen und 2 Tage vorher)",
    story: "Eure Date-Story ist fertig (Ende Dezember)",
    prep: "Vorbereitung: offene Punkte am Vortag (18 Uhr)",
  };

  if (!publicKey) {
    return <p className="font-semibold text-muted">Push ist auf dem Server noch nicht eingerichtet (VAPID-Schlüssel fehlen).</p>;
  }
  if (support === null) return <div className="h-14 animate-pulse rounded-2xl bg-track" />;
  if (support === "ios-browser") return <IosInstallGuide />;
  if (support === "unsupported") {
    return <p className="font-semibold text-muted">Dieser Browser kann leider keine Push-Benachrichtigungen.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {subscription ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold">🔔 Push ist auf diesem Gerät an</span>
          <Button size="sm" variant="secondary" onClick={test} disabled={pending}>
            Test-Push
          </Button>
          <button type="button" onClick={disable} disabled={pending} className="text-sm font-extrabold text-muted underline">
            Ausschalten
          </button>
        </div>
      ) : permission === "denied" ? (
        <PushDeniedHelp />
      ) : (
        <Button onClick={enable} disabled={pending} className="w-full">
          🔔 Push aktivieren
        </Button>
      )}
      {message && (
        <p role="status" className="text-sm font-bold">
          {message}
        </p>
      )}

      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-extrabold">
          <span>
            Welche Erinnerungen?{" "}
            <span className="text-sm text-muted">
              {NOTIFICATION_TYPES.filter((t) => prefs[t]).length} von {NOTIFICATION_TYPES.length} an
            </span>
          </span>
          <span aria-hidden="true" className="text-xl transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
      <fieldset className="mt-3 flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-extrabold text-muted">Erinnere mich an …</legend>
        {NOTIFICATION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="switch"
            aria-checked={prefs[type]}
            onClick={() => toggle(type)}
            className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface px-3 py-2.5 text-left font-semibold"
          >
            <span>{labels[type]}</span>
            <span
              aria-hidden="true"
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full border-2 border-line transition-colors",
                prefs[type] ? "bg-minze" : "bg-track",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full border-2 border-line bg-surface transition-[left]",
                  prefs[type] ? "left-[22px]" : "left-0.5",
                )}
              />
            </span>
          </button>
        ))}
      </fieldset>
      <p className="mt-2 text-sm font-semibold text-muted">Zwischen 22 und 8 Uhr ist Ruhe – außer bei „Date in 2 Stunden“.</p>
      </details>
    </div>
  );
}
