"use client";

import { useEffect, useState, useTransition } from "react";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
  setNotificationPrefAction,
} from "@/app/(app)/settings/actions";
import { cn } from "@/lib/cn";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/domain";
import { Button } from "./button";
import { detectPushSupport, type PushSupport } from "./service-worker";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Step-by-step: push on iPhone only works for apps on the home screen. */
export function IosInstallGuide() {
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border-2 border-line bg-zitrone-soft p-4 text-tinte">
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
          Dort unter Einstellungen „Push aktivieren“
        </li>
      </ol>
    </div>
  );
}

export function PushSettings({
  publicKey,
  prefs: initialPrefs,
  partnerName,
}: {
  publicKey: string | null;
  prefs: Record<NotificationType, boolean>;
  partnerName: string;
}) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [prefs, setPrefs] = useState(initialPrefs);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const detected = detectPushSupport();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capabilities are only known on the client
    setSupport(detected);
    if (detected !== "supported") return;
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then(setSubscription).catch(() => {});
  }, []);

  function enable() {
    startTransition(async () => {
      setMessage(null);
      try {
        // Ask first, directly in the tap – iOS insists on that.
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") {
          setMessage("Ohne Erlaubnis keine Erinnerungen. Du kannst sie in den Einstellungen deines Geräts erlauben.");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey!) });
        const saved = await savePushSubscriptionAction(sub.toJSON(), navigator.userAgent);
        if (!saved.ok) throw new Error("not saved");
        setSubscription(sub);
        setMessage("Push ist an! 🔔");
      } catch (error) {
        console.warn("[push] subscribe failed", error);
        setMessage("Das hat nicht geklappt. Versuch es nochmal oder starte die App neu.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      if (!subscription) return;
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe().catch(() => {});
      await removePushSubscriptionAction(endpoint);
      setSubscription(null);
      setMessage("Push ist auf diesem Gerät aus.");
    });
  }

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
    turn_started: "Du bist dran (Rundenstart, ab 9 Uhr)",
    deadline_soon: "Frist naht (24 Std. vorher)",
    partner_activity: `${partnerName} plant, bestätigt oder sagt ab`,
    date_tomorrow: "Date ist morgen (19 Uhr am Vortag)",
    date_soon: "Date in 2 Stunden",
    review_due: "Wie war's? (am Tag nach dem Date)",
    system: "Wichtiges (z. B. ein Kalender wurde getrennt)",
    match: "Match! – ihr mögt beide dieselbe Idee",
    deck_nudge: `Entdecken: ${partnerName} hat Ideen geliked oder super-geliked`,
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
        <p className="font-semibold">
          Benachrichtigungen sind für den Date-O-Mat blockiert. Erlaube sie in den Einstellungen deines Browsers oder Handys
          und lade die Seite neu.
        </p>
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

      <fieldset className="flex flex-col gap-2">
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
      <p className="text-sm font-semibold text-muted">Zwischen 22 und 8 Uhr ist Ruhe – außer bei „Date in 2 Stunden“.</p>
    </div>
  );
}
