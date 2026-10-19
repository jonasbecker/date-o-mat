"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { BulbIcon, HeartIcon, SlidersIcon } from "./icons";

const ICONS = { bulb: BulbIcon, heart: HeartIcon, sliders: SlidersIcon };

/** A round icon in the page header (settings). On its own page it leads back to the start. */
export function HeaderIcon({
  href,
  label,
  icon,
  active,
  badge,
  marker,
}: {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  active: boolean;
  /** Sits on the corner of the icon (e.g. the wishlist count). */
  badge?: React.ReactNode;
  /** Lets scripts find the icon (the swipe deck flies hearts to it). */
  marker?: string;
}) {
  const Icon = ICONS[icon];
  return (
    <Link
      href={active ? "/plan" : href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-header-icon={marker}
      className={cn("press relative flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-line", active ? "bg-himbeere-soft text-tinte" : "bg-surface")}
    >
      <Icon width={20} height={20} />
      {badge}
    </Link>
  );
}
