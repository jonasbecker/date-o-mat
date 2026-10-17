import Link from "next/link";
import { HeaderIcon } from "./header-icon";
import { LogoLockup } from "./logo";

export type HeaderPlace = "plan" | "ideas" | "dates" | "settings";

/**
 * The only navigation: the app is one flow ("Date planen"), the rest sits in
 * three icons on the right – 💡 wishlist, 💞 past dates, ⚙️ settings. Each
 * drops its page down from the top; the same icon folds it up again.
 * The logo leads back to the start.
 */
export function AppHeader({ current = "plan", action }: { current?: HeaderPlace; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-2.5">
        <Link href="/plan" aria-label="Date-O-Mat – zum Start" className="min-w-0 flex-1">
          <LogoLockup clipId="header-logo" />
        </Link>
        <HeaderIcon href="/ideas" label="Ideen" icon="bulb" active={current === "ideas"} />
        <HeaderIcon href="/dates" label="Eure Dates" icon="heart" active={current === "dates"} />
        <HeaderIcon href="/settings" label="Einstellungen" icon="sliders" active={current === "settings"} />
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
