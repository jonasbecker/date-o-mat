import Link from "next/link";
import type { User } from "@/server/db/schema";
import { AvatarPair } from "./avatar";
import { SlidersIcon } from "./icons";
import { LogoLockup } from "./logo";

export function AppHeader({ user, partner }: { user: User; partner: User }) {
  return (
    <header className="flex items-center justify-between">
      <LogoLockup clipId="header-logo" />
      <span className="flex items-center gap-2.5">
        <AvatarPair a={user} b={partner} />
        <Link
          href="/settings"
          aria-label="Einstellungen"
          className="press flex size-10 items-center justify-center rounded-full border-2 border-line bg-surface"
        >
          <SlidersIcon width={20} height={20} />
        </Link>
      </span>
    </header>
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
