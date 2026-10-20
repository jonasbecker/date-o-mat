"use client";

// The hint on top of Setup (ThSetup.html) – only when something is missing: a sad little flower (just
// its head) says what, and one button fixes it. Push off comes first, then the calendars, then the rest.
import Link from "next/link";
import { Bloom } from "@/components/bloom";
import { usePush } from "@/components/use-push";

export function GardenBanner({ publicKey, calendarsMissing, otherProblem }: { publicKey: string | null; calendarsMissing: boolean; otherProblem: boolean }) {
  const push = usePush(publicKey);
  // Until the browser said whether you get pushes, nothing about push.
  const pushOff = Boolean(publicKey) && push.support !== null && !push.subscription && push.support !== "unsupported";
  const message = pushOff
    ? { text: "mein wecker ist aus – so merkt ihr nicht, wann ihr dran seid.", action: <BannerButton onClick={() => push.enable()} disabled={push.pending || push.permission === "denied" || push.support === "ios-browser"}>Push anmachen</BannerButton> }
    : calendarsMissing
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
        {pushOff && push.permission === "denied" && <span className="text-xs">Der Browser blockiert Push – in den Einstellungen des Handys erlauben.</span>}
      </div>
    </div>
  );
}

function BannerButton({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button type="button" className="press h-8 self-start rounded-full bg-[#111A14] px-3.5 text-[13px] font-bold text-butter disabled:opacity-60" {...props}>
      {children}
    </button>
  );
}

function BannerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="press flex h-8 items-center self-start rounded-full bg-[#111A14] px-3.5 text-[13px] font-bold text-butter">
      {children}
    </Link>
  );
}
