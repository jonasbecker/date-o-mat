"use client";

// The hint on top of Setup (ThSetup.html) – only when something is missing: a sad little flower (just
// its head) says what, and one button fixes it: the calendars, then the rest. Push is the switch below
// (one place for it – the Beet's flower says it too).
import Link from "next/link";
import { Bloom } from "@/components/bloom";

export function GardenBanner({ calendarsMissing, otherProblem }: { calendarsMissing: boolean; otherProblem: boolean }) {
  const message = calendarsMissing
    ? { text: "ich seh eure kalender nicht – so finde ich keine freien abende.", action: <BannerLink href="/settings?t=kalender">Kalender verbinden</BannerLink> }
    : otherProblem
      ? { text: "irgendwas hakt bei mir … schau mal nach.", action: <BannerLink href="/settings?t=status">Läuft alles?</BannerLink> }
      : null;
  if (!message) return null;
  return (
    <div role="status" data-garden-banner className="grid min-h-[104px] shrink-0 grid-cols-[82px_minmax(0,1fr)] items-center overflow-hidden rounded-[22px] bg-butter text-[#2B1D12]">
      <div aria-hidden="true" className="relative h-[104px] w-[82px] overflow-hidden">
        <Bloom stimmung="traurig" blaetter={2} grund="#F5EFC6" className="absolute -left-8 -top-2.5 h-[176px] w-[126px]" />
      </div>
      <div className="flex flex-col gap-2 py-3 pl-1 pr-3.5">
        <span className="font-hand text-[21px] font-semibold leading-[1.02]">{message.text}</span>
        {message.action}
      </div>
    </div>
  );
}

function BannerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="press flex h-8 items-center self-start rounded-full bg-[#111A14] px-3.5 text-[13px] font-bold text-butter">
      {children}
    </Link>
  );
}
