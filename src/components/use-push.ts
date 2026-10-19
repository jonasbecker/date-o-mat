"use client";

import { useEffect, useState, useTransition } from "react";
import { removePushSubscriptionAction, savePushSubscriptionAction } from "@/app/(app)/settings/actions";
import { detectPushSupport, type PushSupport } from "./service-worker";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Push on this device: what the browser can do, whether a subscription exists, and
 * `enable()` / `disable()`. Shared by the settings, the introduction and the start page.
 * `support` stays null until the browser has been asked (server render).
 */
export function usePush(publicKey: string | null) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
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
        if (result !== "granted") return;
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

  return { support, permission, subscription, message, setMessage, pending, enable, disable };
}
