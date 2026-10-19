"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import { BulbIcon, DiceIcon, HeartIcon, PlusIcon, SparkleIcon } from "./icons";
import { LogoMark } from "./logo";
import { QUICK_ADD_EVENT, QuickAdd } from "./quick-add";
import { SURPRISE_EVENT, SurpriseButton } from "./surprise-button";

function Side({ href, label, shown, active, marker, badge, children }: { href: string; label: string; shown: string; active: boolean; marker?: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-header-icon={marker}
      className="press relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl"
    >
      <span className={cn("relative flex h-8 w-14 items-center justify-center rounded-full border-2", active ? "border-line bg-himbeere-soft text-tinte" : "border-transparent text-ink")}>
        {children}
        {badge}
      </span>
      <span className={cn("text-[12px] leading-none", active ? "font-extrabold" : "font-bold text-muted")} aria-hidden="true">
        {shown}
      </span>
    </Link>
  );
}

/**
 * The navigation of the app: wishlist on the left, past dates on the right and the logo in the
 * middle – it leads to the start (the box with "Date planen"). Settings sit at the top. `wishlistBadge` is the count on 💡.
 */
export function BottomNav({ wishlistBadge }: { wishlistBadge?: React.ReactNode }) {
  return <BottomNavBar path={usePathname()} wishlistBadge={wishlistBadge} />;
}

/** The bar itself – also what shows while the current path is still unknown (prerender). */
export function BottomNavBar({ path, wishlistBadge }: { path: string; wishlistBadge?: React.ReactNode }) {
  return (
    <nav aria-label="Hauptmenü" className="shrink-0 border-t-2 border-line bg-bg px-5 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
      <div className="mx-auto flex max-w-md items-end justify-between gap-2">
        <Side href="/ideas" label="Ideen" shown="Ideen" active={path.startsWith("/ideas")} marker="wishlist" badge={wishlistBadge}>
          <BulbIcon width={22} height={22} />
        </Side>
        <LogoButton onStart={path === "/plan"} />
        <Side href="/dates" label="Eure Dates" shown="Dates" active={path.startsWith("/dates")}>
          <HeartIcon width={22} height={22} />
        </Side>
      </div>
    </nav>
  );
}

const LOGO_CLASS = "sticker press -mt-6 flex size-[72px] shrink-0 items-center justify-center rounded-full bg-zitrone-soft";

/** Where the logo is only a way home it is a link; on the start itself it opens the actions. */
function LogoButton({ onStart }: { onStart: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!onStart) {
    return (
      <Link href="/plan" aria-label="Zum Start" data-nav-home className={LOGO_CLASS}>
        <LogoMark size={54} clipId="nav-logo" />
      </Link>
    );
  }
  const fire = (event: string) => {
    setOpen(false);
    window.dispatchEvent(new Event(event));
  };
  const item = "animate-pop-in flex flex-col items-center gap-1.5 text-[12px] font-extrabold";
  const label = "rounded-full border-2 border-line bg-surface px-2.5 py-0.5 text-ink whitespace-nowrap";
  const round = "sticker press flex size-14 items-center justify-center rounded-full text-tinte";
  return (
    <div className="relative">
      {open && <button type="button" aria-label="Menü schließen" tabIndex={-1} onClick={() => setOpen(false)} className="animate-pop-in fixed inset-0 z-30 cursor-default bg-tinte/50" />}
      {open && (
        <div role="menu" aria-label="Aktionen" className="absolute bottom-[4.6rem] left-1/2 z-40 flex -translate-x-1/2 items-end gap-1.5">
          <Link role="menuitem" href="/plan?pick=1" onClick={() => setOpen(false)} className={`${item} mb-1`}>
            <span className={`${round} bg-himbeere`}>
              <SparkleIcon width={24} height={24} />
            </span>
            <span className={label}>Date planen</span>
          </Link>
          <Link role="menuitem" href="/ideas/entdecken" onClick={() => setOpen(false)} className={`${item} mb-9`}>
            <span className={`${round} bg-himbeere-soft`}>
              <HeartIcon width={24} height={24} />
            </span>
            <span className={label}>Swipen</span>
          </Link>
          <button role="menuitem" type="button" onClick={() => fire(QUICK_ADD_EVENT)} className={`${item} mb-9`}>
            <span className={`${round} bg-zitrone`}>
              <PlusIcon width={24} height={24} />
            </span>
            <span className={label}>Idee</span>
          </button>
          <button role="menuitem" type="button" onClick={() => fire(SURPRISE_EVENT)} className={`${item} mb-1`}>
            <span className={`${round} bg-minze`}>
              <DiceIcon width={24} height={24} />
            </span>
            <span className={label}>Überrasch uns</span>
          </button>
        </div>
      )}
      <button type="button" aria-label="Aktionen" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${LOGO_CLASS} relative z-40`}>
        <span className={open ? "animate-wiggle" : undefined}>
          <LogoMark size={54} clipId="nav-logo" />
        </span>
        <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 flex size-6 items-center justify-center rounded-full border-2 border-line bg-himbeere text-tinte transition-transform duration-200 ${open ? "rotate-45" : ""}`}>
          <PlusIcon width={14} height={14} />
        </span>
      </button>
      <QuickAdd eventOnly />
      <SurpriseButton eventOnly />
    </div>
  );
}
