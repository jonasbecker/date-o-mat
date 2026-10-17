"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { BulbIcon, HeartIcon, SlidersIcon } from "./icons";

const ICONS = { bulb: BulbIcon, heart: HeartIcon, sliders: SlidersIcon };

/**
 * A header icon opens its page (it drops down from the top, see `Panel`). On the
 * page it belongs to, the same icon folds it up again and shows the start.
 */
export function HeaderIcon({ href, label, icon, active }: { href: string; label: string; icon: keyof typeof ICONS; active: boolean }) {
  const router = useRouter();
  const Icon = ICONS[icon];
  return (
    <Link
      href={active ? "/plan" : href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={(event) => {
        if (!active) return;
        // Fold the open page up first, then show the start.
        const panel = [...document.querySelectorAll<HTMLElement>("[data-panel]")].find((el) => el.offsetParent !== null);
        if (!panel) return;
        event.preventDefault();
        panel.classList.add("animate-lift-out");
        setTimeout(() => router.push("/plan"), 200);
      }}
      className={cn("press flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-line", active ? "bg-himbeere-soft text-tinte" : "bg-surface")}
    >
      <Icon width={20} height={20} />
    </Link>
  );
}
