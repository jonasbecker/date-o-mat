import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { BulbIcon, HeartIcon, SlidersIcon } from "./icons";
import { LogoLockup, LogoMark } from "./logo";

export type HeaderPlace = "plan" | "ideas" | "dates" | "settings";

function IconLink({ href, label, Icon, active }: { href: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>>; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn("press flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-line", active ? "bg-himbeere-soft text-tinte" : "bg-surface")}
    >
      <Icon width={20} height={20} />
    </Link>
  );
}

/**
 * The only navigation: the app is one flow ("Date planen"), the rest sits in
 * small icons – 💡 ideas on the left, 💞 past dates and ⚙️ settings on the right.
 * The logo leads back to the start; other pages also get a "← Date planen" link.
 */
export function AppHeader({ current = "plan", action }: { current?: HeaderPlace; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-2.5">
        <IconLink href="/ideas" label="Ideen" Icon={BulbIcon} active={current === "ideas"} />
        {current === "plan" ? (
          <Link href="/plan" aria-label="Date-O-Mat – zum Start" className="min-w-0 flex-1">
            <LogoLockup clipId="header-logo" />
          </Link>
        ) : (
          // Elsewhere just the little machine – it leads back to the start.
          <Link href="/plan" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-extrabold text-muted">
            <LogoMark size={30} clipId="header-logo" />
            <span className="underline">← Date planen</span>
          </Link>
        )}
        <IconLink href="/dates" label="Eure Dates" Icon={HeartIcon} active={current === "dates"} />
        <IconLink href="/settings" label="Einstellungen" Icon={SlidersIcon} active={current === "settings"} />
      </header>
      {action && <div className="flex min-h-9 items-center justify-end">{action}</div>}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-label="Lädt …">
      <div className="h-10 w-40 rounded-full bg-track" />
      <div className="h-44 rounded-[28px] bg-track" />
      <div className="h-16 rounded-[22px] bg-track" />
    </div>
  );
}
