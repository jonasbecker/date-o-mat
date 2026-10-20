// The Beet (DESIGN.md §1, screens MBeet, MBeetSie, MEinladung, MBestaetigt): the start page.
// A big lowercase headline says whose turn it is, the plant shows every date lived, and there is
// one thing to do – "Date planen", "Anstupsen", "Zusagen" or "Wie war's?".
import Link from "next/link";
import { DateTime } from "luxon";
import { confirmDateAction, swapTurnAction } from "./actions";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/button";
import { ConfettiActionButton } from "@/components/confetti";
import { NudgeButton } from "@/components/nudge-button";
import { Plant } from "@/components/plant";
import { StepDots } from "@/components/step-dots";
import { StartReview } from "@/components/start-review";
import { SuggestionCard } from "@/components/suggestion-card";
import { SwapIcon } from "@/components/icons";
import { Info } from "@/components/info";
import { leafKinds, type BudState, type LeafKind } from "@/core/plant";
import { periodLabel, type NextStep } from "@/core/next-step";
import { APP_TIMEZONE, PERSON_HEX } from "@/lib/domain";
import { formatShortDate, formatTimeRange, timeLeftLabel, shortDeadline } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CoupleContext } from "@/server/auth/dal";
import type { DatePlan, User } from "@/server/db/schema";
import type { Round } from "@/server/plant";
import type { Overview } from "./overview";

const hex = (u: User) => PERSON_HEX[u.color ?? "mandarine"];

/** The round as four dots: open → planned → confirmed → lived. */
function roundDot(step: NextStep["kind"]): number {
  switch (step) {
    case "plan":
    case "partner_turn":
    case "suggestion":
    case "connect_calendar":
    case "partner_calendar":
      return 1;
    case "confirm":
    case "wait_confirm":
      return 2;
    case "date_ahead":
      return 3;
    default:
      return 4;
  }
}

function weekday(d: Date) {
  return DateTime.fromJSDate(d, { zone: APP_TIMEZONE }).setLocale("de").toFormat("cccc");
}
function shortWhen(d: Date) {
  return DateTime.fromJSDate(d, { zone: APP_TIMEZONE }).setLocale("de").toFormat("ccc HH:mm").replace(".", "");
}

/** The avatars top right; whoever has the watering can gets the ring. */
export function BeetAvatars({ me, partner, onTurn }: { me: User; partner: User; onTurn: "me" | "partner" | null }) {
  return (
    <span className="flex items-center" aria-label={onTurn ? `${onTurn === "me" ? me.name : partner.name} ist dran` : undefined} role={onTurn ? "img" : undefined}>
      <Avatar person={me} size={30} className={cn(onTurn !== "me" && "ring-transparent")} />
      <Avatar person={partner} size={30} className={cn("-ml-1.5", onTurn !== "partner" && "ring-transparent")} />
    </span>
  );
}

type View = {
  headline: string;
  sub?: React.ReactNode;
  pill?: { when: string; title: string };
  bud: BudState;
  can?: { who: User; pouring: boolean };
  fresh?: boolean;
  /** The Einladung: a small plant and the date card instead of the big plant. */
  invitation?: boolean;
  cta: React.ReactNode;
};

export function Beet({
  o,
  ctx,
  now,
  rounds,
  swappable,
  notices,
}: {
  o: Overview;
  ctx: CoupleContext;
  now: Date;
  rounds: Round[];
  swappable: boolean;
  /** Small lines that belong on the start (reminders, setup, special days …). */
  notices?: React.ReactNode;
}) {
  const { user: me, partner } = ctx;
  const step = o.step;
  const cycle = o.cycle;
  if (!step || !cycle) return null;
  const date = o.shownDate;
  const deadline = `${periodLabel(cycle.startsAt, cycle.endsAt)} · ${
    cycle.deadlineAt > now ? `Plan bis ${shortDeadline(cycle.deadlineAt)} · ${timeLeftLabel(now, cycle.deadlineAt)}` : `Geht noch bis ${formatShortDate(new Date(cycle.endsAt.getTime() - 1))}`
  }`;
  const view = viewFor(step, { me, partner, date, deadline, swappable, o, now });
  const leaves: LeafKind[] = leafKinds(rounds);
  // The upcoming (or just lived) date is the pink leaf on top.
  if (view.fresh) leaves.push("fresh");
  const onTurn = view.can ? (view.can.who.id === me.id ? "me" : "partner") : null;

  return (
    <div data-next-step={step.kind} className="flex min-h-0 flex-1 flex-col">
      {/* The four dots always sit right under the name – only the active one moves. */}
      <StepDots step={roundDot(step.kind)} of={4} className="mt-1 h-1.5" />
      <h2 className="headline mt-3 min-h-[2lh] whitespace-pre-line text-[clamp(44px,15vw,62px)]">{view.headline}</h2>
      {view.sub && <div className="mt-3 text-base text-muted">{view.sub}</div>}
      {view.pill && (
        <p data-date-pill data-date-card={date?.id} className="mt-3.5 inline-flex h-[34px] max-w-full items-center self-start truncate rounded-full bg-surface px-3.5 text-sm font-medium">
          <span className="shrink-0">{view.pill.when}&nbsp;·&nbsp;</span>
          <span className="truncate">{view.pill.title}</span>
        </p>
      )}
      {date?.syncStatus === "error" && (
        <p role="status" className="mt-3 rounded-[18px] bg-zitrone-soft px-3.5 py-2 text-sm text-tinte">
          Google Kalender hakt gerade – der Date-O-Mat versucht es nochmal.
        </p>
      )}
      {notices && <div className="mt-3 flex flex-col gap-2">{notices}</div>}
      {view.invitation && date ? (
        <Invitation date={date} partner={partner} surprise={o.dateExtras?.surprise === "hidden"} />
      ) : (
        <div className="relative -mx-5 min-h-24 flex-1">
          <Plant
            leaves={leaves}
            bud={view.bud}
            can={view.can && { color: hex(view.can.who), pouring: view.can.pouring }}
            label={`Euer Beet: ${rounds.filter((r) => r === "done").length} ${rounds.filter((r) => r === "done").length === 1 ? "Blatt" : "Blätter"}`}
            className="absolute inset-0 size-full py-3"
          />
        </div>
      )}
      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-2" data-onturn={onTurn ?? undefined}>
        {view.cta}
      </div>
    </div>
  );
}

function viewFor(
  step: NextStep,
  { me, partner, date, deadline, swappable, o, now }: { me: User; partner: User; date?: DatePlan; deadline: string; swappable: boolean; o: Overview; now: Date },
): View {
  const details = date && (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold">
      <Link href={`/dates/${date.id}`} className="underline">
        Details ›
      </Link>
      {o.dateExtras?.isToday && (
        <Link href="/fragen" className="underline">
          💬 Gesprächskarten
        </Link>
      )}
      {swappable && (
        <Link href="/plan?pick=1" className="flex items-center gap-1.5 underline">
          <SwapIcon width={15} height={15} /> Lieber was anderes?
        </Link>
      )}
    </div>
  );
  switch (step.kind) {
    case "plan":
      return {
        headline: "du bist\ndran.",
        sub: <Deadline text={deadline} />,
        bud: "waiting",
        can: { who: me, pouring: true },
        cta: (
          <>
            <Link href="/plan?pick=1" className={buttonClass("primary", "lg", "w-full")}>
              Date planen
            </Link>
            <form action={swapTurnAction} className="self-center">
              <button type="submit" className="h-9 text-sm font-semibold text-muted underline">
                Diesmal an {partner.name} abgeben
              </button>
            </form>
          </>
        ),
      };
    case "partner_turn":
      return {
        headline: `kanne\nbei ${partner.name}.`,
        sub: <Deadline text={deadline} />,
        bud: "waiting",
        can: { who: partner, pouring: false },
        cta: (
          <>
            <NudgeButton />
            <form action={swapTurnAction} className="self-center">
              <button type="submit" className="h-9 text-sm font-semibold text-muted underline">
                Ich übernehme diesmal
              </button>
            </form>
          </>
        ),
      };
    case "wait_confirm":
      return {
        headline: `kanne\nbei ${partner.name}.`,
        pill: date ? { when: shortWhen(date.startsAt), title: date.title } : undefined,
        bud: "filled",
        can: { who: partner, pouring: false },
        cta: (
          <>
            <NudgeButton />
            {details}
          </>
        ),
      };
    case "confirm":
      return {
        headline: `${partner.name} hat\ngegossen.`,
        bud: "filled",
        invitation: true,
        cta: date && (
          <>
            <ConfettiActionButton action={confirmDateAction.bind(null, date.id)} variant="primary" className="w-full">
              Zusagen
            </ConfettiActionButton>
            <Link href={`/plan?reschedule=${date.id}`} className={buttonClass("secondary", "lg", "w-full")}>
              Anderer Termin
            </Link>
            {details}
          </>
        ),
      };
    case "date_ahead": {
      const mine = date?.proposedById === me.id;
      return {
        headline: "neues\nblatt!",
        sub: date && (
          <>
            {mine ? `${partner.name} hat zugesagt.` : "Du hast zugesagt."} Ihr seht euch {weekday(date.startsAt)}.
          </>
        ),
        bud: "none",
        fresh: true,
        cta: date && (
          <>
            <DateCard date={date} surprise={o.dateExtras?.surprise ?? null} partner={partner} />
            {details}
          </>
        ),
      };
    }
    case "review":
      return {
        headline: "wie war's?",
        sub: o.toReview?.title,
        bud: "none",
        fresh: true,
        cta: o.toReview && (
          <div className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
            <StartReview date={o.toReview} photoId={o.reviewPhoto} />
          </div>
        ),
      };
    case "suggestion":
      return {
        headline: "zeit für\nein date.",
        sub: <Deadline text={deadline} />,
        bud: "waiting",
        cta:
          o.suggestion?.status === "ok" ? (
            <div className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
              <SuggestionCard suggestion={o.suggestion.suggestion} idea={o.suggestion.idea} />
            </div>
          ) : (
            <Link href="/plan?pick=1" className={buttonClass("primary", "lg", "w-full")}>
              Date planen
            </Link>
          ),
      };
    case "round_done":
      return step.skipped
        ? { headline: "diesmal\nwelk.", sub: `Kein Date diesmal – passiert. Weiter geht's am ${formatShortDate(o.cycle!.endsAt)}.`, bud: "waiting", cta: null }
        : { headline: "geschafft.", sub: `Weiter geht's am ${formatShortDate(o.cycle!.endsAt)}.`, bud: "waiting", cta: null };
    case "connect_calendar":
    case "partner_calendar":
      return { headline: "fast\nstartklar.", bud: "waiting", cta: null };
  }
  void now;
}

/** "bis Do 20 Uhr · noch 2 Tage" with the one ⓘ (what "Plan bis" means). */
function Deadline({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs">{text}</span>
      <Info term="frist" />
    </span>
  );
}

/** MEinladung: when, where, what (and the note) – what the other one has planned. */
function Invitation({ date, partner, surprise }: { date: DatePlan; partner: User; surprise: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 py-3">
      <Plant leaves={["leaf", "leaf", "leaf"]} bud="filled" fit="tight" className="mx-auto h-[clamp(64px,16vh,150px)] w-auto" />
      <div data-date-card={date.id} className="flex flex-col gap-3.5 rounded-[24px] bg-surface p-[18px]">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-0.5 rounded-2xl bg-soft p-3">
            <span className="meta text-muted">wann</span>
            <span className="text-xl font-extrabold tracking-[-0.02em]">{formatShortDate(date.startsAt)}</span>
            <span className="text-sm">{formatTimeRange(date.startsAt, date.endsAt)}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 rounded-2xl bg-soft p-3">
            <span className="meta text-muted">wo</span>
            <span className="truncate text-xl font-extrabold tracking-[-0.02em]">{date.location ?? "offen"}</span>
            <span className="text-sm">{date.location ? "" : "sagt euch noch"}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="meta text-muted">was</span>
          <span className="text-2xl font-extrabold leading-[1.05] tracking-[-0.03em]">{date.title}</span>
          {surprise ? (
            <span className="text-[15px] text-muted">
              🤫 Eine Überraschung von {partner.name} – mehr erfährst du am Tag selbst.{date.note ? ` Hinweis: ${date.note}` : ""}
            </span>
          ) : (
            date.note && <span className="text-[15px] text-muted">„{date.note}“</span>
          )}
        </div>
        <p className="text-[13px] text-muted">In beiden Kalendern frei</p>
      </div>
    </div>
  );
}

/** MBestaetigt: the date with its chips. */
function DateCard({ date, surprise, partner }: { date: DatePlan; surprise: "hidden" | "organizer" | null; partner: User }) {
  return (
    <div data-date-card={date.id} className="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4">
      <p className="text-xl font-extrabold leading-tight tracking-[-0.02em]">{date.title}</p>
      <p className="text-[15px] text-muted">
        {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)}
        {date.location ? ` · ${date.location}` : ""}
      </p>
      {surprise === "hidden" && <p className="text-[15px] text-muted">🤫 Eine Überraschung von {partner.name}{date.note ? ` · ${date.note}` : ""}</p>}
      {surprise === "organizer" && <p className="text-[15px] text-muted">🎁 {partner.name} sieht bis zum Tag nur die Zeit.</p>}
      <div className="flex flex-wrap gap-1.5">
        {date.syncStatus === "synced" && <span className="inline-flex h-[30px] items-center rounded-full bg-soft px-3 text-[13px] font-medium">✓ in beiden Kalendern</span>}
      </div>
    </div>
  );
}
