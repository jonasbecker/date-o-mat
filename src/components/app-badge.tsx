"use client";

import { useEffect } from "react";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/** Puts the number on the app icon (installed app; iOS needs the notification permission) – 0 clears it. */
export function AppBadge({ count }: { count: number }) {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge) return;
    (count > 0 ? nav.setAppBadge(count) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0))).catch(() => {
      // no permission yet – nothing to show
    });
  }, [count]);
  return <span hidden data-app-badge={count} />;
}
