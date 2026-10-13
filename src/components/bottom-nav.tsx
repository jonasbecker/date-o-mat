"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { HomeIcon, SlidersIcon } from "./icons";

type NavItem = { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> };

// Tabs are added as their milestone lands (Ideen in M2, Planen in M3).
const ITEMS: NavItem[] = [
  { href: "/", label: "Start", Icon: HomeIcon },
  { href: "/settings", label: "Einstellungen", Icon: SlidersIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t-[2.5px] border-line bg-surface pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-16 flex-col items-center gap-0.5 text-[11px] font-extrabold",
                  active ? "text-ink" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-[52px] items-center justify-center rounded-full",
                    active && "border-2 border-line bg-himbeere-soft text-tinte",
                  )}
                >
                  <Icon width={20} height={20} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
