"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/cn";
import { BulbIcon, CalendarIcon, HeartIcon, HomeIcon } from "./icons";
import { QuickAdd } from "./quick-add";

type NavItem = { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; also?: string[] };

const LEFT: NavItem[] = [
  { href: "/", label: "Start", Icon: HomeIcon },
  { href: "/ideas", label: "Ideen", Icon: BulbIcon, also: ["/events"] },
];
const RIGHT: NavItem[] = [
  { href: "/plan", label: "Planen", Icon: CalendarIcon },
  { href: "/dates", label: "Dates", Icon: HeartIcon },
];

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const active =
    pathname !== null &&
    (item.href === "/" ? pathname === "/" : [item.href, ...(item.also ?? [])].some((href) => pathname.startsWith(href)));
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
        {LEFT.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
        <li>
          <QuickAdd />
        </li>
        {RIGHT.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </nav>
  );
}
