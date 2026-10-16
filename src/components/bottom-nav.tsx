"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/cn";
import { BulbIcon, CalendarIcon, HeartIcon } from "./icons";

type NavItem = { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; also?: string[] };

// The order of a date: collect ideas → plan it → have it (and look back).
const IDEAS: NavItem = { href: "/ideas", label: "Ideen", Icon: BulbIcon, also: ["/events"] };
const DATES: NavItem = { href: "/dates", label: "Dates", Icon: HeartIcon, also: ["/story", "/budget", "/fragen"] };

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const active = pathname !== null && [item.href, ...(item.also ?? [])].some((href) => pathname.startsWith(href));
  return (
    <li>
      <Link
        href={item.href}
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
          <item.Icon width={20} height={20} />
        </span>
        {item.label}
      </Link>
    </li>
  );
}

/**
 * On routes with a dynamic param (/dates/[id]) the pathname is only known at
 * request time, so the prerendered shell shows the nav without a highlight.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <CurrentNav />
    </Suspense>
  );
}

function CurrentNav() {
  return <NavBar pathname={usePathname()} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Hauptnavigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t-[2.5px] border-line bg-surface pb-[max(env(safe-area-inset-bottom),12px)] pt-2"
    >
      <ul className="mx-auto flex max-w-md items-start justify-around px-2">
        <NavLink item={IDEAS} pathname={pathname} />
        <li>
          <PlanButton active={pathname?.startsWith("/plan") ?? false} />
        </li>
        <NavLink item={DATES} pathname={pathname} />
      </ul>
    </nav>
  );
}

/** The big round button in the middle: planning is what the app is for. */
function PlanButton({ active }: { active: boolean }) {
  return (
    <Link href="/plan" aria-current={active ? "page" : undefined} className="flex flex-col items-center gap-0.5">
      <span
        className={cn(
          "press -mt-8 flex size-[64px] items-center justify-center rounded-full border-[2.5px] border-line bg-himbeere text-tinte shadow-[3px_3px_0_var(--line)]",
          active && "ring-4 ring-himbeere-soft",
        )}
      >
        <CalendarIcon width={28} height={28} />
      </span>
      <span className={cn("text-[11px] font-extrabold", active ? "text-ink" : "text-muted")}>Date planen</span>
    </Link>
  );
}
