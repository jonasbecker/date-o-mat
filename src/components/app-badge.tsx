"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { badgeAction } from "@/app/badge-action";

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * The number on the app icon (installed app; iOS needs the notification permission): what waits for me. Asked
 * for once the page is there – not while it renders, so no page waits for it – when the app opens, comes to the
 * front and after each navigation (an action on the last page may have answered something). Pushes bring it too.
 */
export function AppBadge() {
  const path = usePathname();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const ask = () => {
      if (document.visibilityState !== "visible") return;
      badgeAction()
        .then((n) => alive && n !== null && setCount(n))
        .catch(() => {
          // offline – the next time
        });
    };
    ask();
    document.addEventListener("visibilitychange", ask);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", ask);
    };
  }, [path]);

  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (count === null || !nav.setAppBadge) return;
    (count > 0 ? nav.setAppBadge(count) : (nav.clearAppBadge?.() ?? nav.setAppBadge(0))).catch(() => {
      // no permission yet – nothing to show
    });
  }, [count]);

  return count === null ? null : <span hidden data-app-badge={count} />;
}
