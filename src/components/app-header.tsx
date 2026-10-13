import type { User } from "@/server/db/schema";
import { AvatarPair } from "./avatar";
import { LogoLockup } from "./logo";

export function AppHeader({ user, partner }: { user: User; partner: User }) {
  return (
    <header className="flex items-center justify-between">
      <LogoLockup clipId="header-logo" />
      <AvatarPair a={user} b={partner} />
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
