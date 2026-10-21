// The Beet (docs/design/main-b: Main Page B; DESIGN.md MBeetSie, MEinladung, MBestaetigt): the start page.
// A big lowercase headline says whose turn it is, the time left stands big on the right, a bar shows
// the round and its deadline, the flower (core/bloom.ts) shows the mood and thinks out loud, and there
// is one thing to do – "Date planen", "Anstupsen", "Zusagen" or "Wie war's?".
import Link from "next/link";
import { DateTime } from "luxon";
import { confirmDateAction, swapTurnAction } from "./actions";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/button";
import { ConfettiActionButton } from "@/components/confetti";
import { NudgeButton } from "@/components/nudge-button";
import { Bloom } from "@/components/bloom";
import { StepDots } from "@/components/step-dots";
import { StartReview } from "@/components/start-review";
import { SuggestionCard } from "@/components/suggestion-card";
import { ArrowIcon, SwapIcon } from "@/components/icons";
import { Info } from "@/components/info";
import { bloomLeaves, bloomSaying, bloomStimmung, type BloomRound, type FlowerPot } from "@/core/bloom";
import { periodLabel, type NextStep } from "@/core/next-step";
import { APP_TIMEZONE } from "@/lib/domain";
import { formatShortDate, formatTimeRange, shortDeadline } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CoupleContext } from "@/server/auth/dal";
import type { DatePlan, User } from "@/server/db/schema";
import type { Round } from "@/server/plant";
import type { Overview } from "./overview";

/** The four dots of the round – in the middle of the header (`AppHeader center`), only the active one moves. */
export function RoundDots({ step }: { step: NextStep["kind"] }) {
  return <StepDots step={1} of={4} all={!stillPlanning(step)} />;
}

/** Before a date is proposed the Beet is dot 1 (the flow is 2–4); from then on the whole bar is lit. */
function stillPlanning(step: NextStep["kind"]): boolean {
  return step === "plan" || step === "partner_turn" || step === "suggestion" || step === "connect_calendar" || step === "partner_calendar";
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
      <Avatar person={me} size={32} className={cn(onTurn !== "me" && "ring-transparent")} />
      <Avatar person={partner} size={32} className={cn("-ml-[7px]", onTurn !== "partner" && "ring-transparent")} />
    </span>
  );
}

type View = {
  headline: string;
  /** The time left until the deadline, big on the right of the headline. */
  deadline?: boolean;
  sub?: React.ReactNode;
  pill?: { when: string; title: string };
  /** Whose turn it is (the ring on the avatar). */
  on?: User;
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
  pot = "terrakotta",
}: {
  o: Overview;
  ctx: CoupleContext;
  now: Date;
  rounds: Round[];
  swappable: boolean;
  /** Small lines that belong on the start (reminders, setup, special days …). */
  notices?: React.ReactNode;
  /** The pot chosen in Setup (already checked against the unlocked ones). */
  pot?: FlowerPot;
}) {
  const { user: me, partner } = ctx;
  const step = o.step;
  const cycle = o.cycle;
  if (!step || !cycle) return null;
  const date = o.shownDate;
  const view = viewFor(step, { me, partner, date, swappable, o, now });
  // Whose turn it is: "du bist dran." and "sam ist dran." are always the same size.
  const turns = ["du bist\ndran.", `${partner.name.toLowerCase()} ist\ndran.`];
  const size = turns.includes(view.headline) ? Math.min(...turns.map((t) => headlineSize(t, true))) : headlineSize(view.headline, view.deadline);
  const onTurn = view.on ? (view.on.id === me.id ? "me" : "partner") : null;
  const { blaetter, welk } = bloomLeaves(rounds);
  const missed = cycle.status === "open" && o.previous?.status === "skipped";
  const hoursLeft = cycle.status === "open" && cycle.deadlineAt > now ? (cycle.deadlineAt.getTime() - now.getTime()) / 3_600_000 : null;
  const lived = step.kind === "review" ? o.toReview?.endsAt : step.kind === "round_done" && !step.skipped ? o.roundDate?.endsAt : undefined;
  const stimmung = bloomStimmung({
    round: roundOf(step),
    livedHoursAgo: lived ? (now.getTime() - lived.getTime()) / 3_600_000 : null,
    lastRoundSkipped: missed,
    hoursLeft,
  });
  const dayOfYear = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).ordinal;
  const saying = bloomSaying(stimmung, dayOfYear, { partner: partner.name, day: date ? weekday(date.startsAt) : undefined, missed });

  return (
    <div data-next-step={step.kind} className="flex min-h-0 flex-1 flex-col">
      <div className="mt-2 flex items-start justify-between gap-3">
        <h2 className="headline whitespace-pre-line font-extrabold leading-[0.9] tracking-[-0.055em]" style={{ fontSize: `${size}px` }}>
          {view.headline}
        </h2>
        {view.deadline && <TimeLeft cycle={cycle} now={now} />}
      </div>
      <WeekBar cycle={cycle} now={now} />
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
        <div className="relative min-h-28 flex-1" data-onturn={onTurn ?? undefined}>
          {/* The flower box keeps the mockup's 300×420 proportions; the bubble sits by its head. */}
          <div className="absolute inset-y-0 left-1/2 aspect-[300/420] max-w-full -translate-x-1/2 [container-type:size]">
            <Bloom stimmung={stimmung} blaetter={blaetter} welk={welk} topf={pot} className="absolute inset-0 size-full" />
            <ThoughtBubble text={saying} />
          </div>
        </div>
      )}
      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-2">{view.cta}</div>
    </div>
  );
}

/** The round as the flower sees it (§3). */
function roundOf(step: NextStep): BloomRound {
  switch (step.kind) {
    case "wait_confirm":
    case "confirm":
      return "eingeladen";
    case "date_ahead":
      return "bestaetigt";
    case "review":
      return "erlebt";
    case "round_done":
      return step.skipped ? "ausgefallen" : "erlebt";
    default:
      return "offen";
  }
}

/** 70 px like the mockup – smaller when a line is long ("charlotte ist dran."), so it never runs into the time on the right. */
function headlineSize(headline: string, withTime?: boolean): number {
  const longest = Math.max(...headline.split("\n").map((line) => line.length));
  const room = withTime ? 228 : 340;
  return Math.min(70, Math.floor(room / (longest * 0.5)));
}

/** "noch / 3h / bis Fr, 20 Uhr" – big on the right; days once more than two are left. */
function TimeLeft({ cycle, now }: { cycle: NonNullable<Overview["cycle"]>; now: Date }) {
  const open = cycle.deadlineAt > now;
  const until = open ? cycle.deadlineAt : cycle.endsAt;
  const hours = Math.max(0, (until.getTime() - now.getTime()) / 3_600_000);
  const [value, unit] = hours < 1 ? ["<1", "h"] : hours < 48 ? [String(Math.floor(hours)), "h"] : [String(Math.floor(hours / 24)), "Tage"];
  return (
    <div data-deadline className="flex shrink-0 flex-col items-end pt-3.5 text-right">
      <span className="meta flex items-center gap-1.5 text-muted">
        <Info term="frist" /> {open ? "noch" : "frist vorbei · runde noch"}
      </span>
      <span className="font-display text-[64px] font-extrabold leading-[0.95] tracking-[-0.05em] text-accent-time">
        {value}
        <span className={unit === "h" ? undefined : "ml-1.5 text-[26px] tracking-[-0.03em]"}>{unit}</span>
      </span>
      <span className="text-[13px] text-muted">{open ? `bis ${shortDeadline(cycle.deadlineAt).replace(" ", ", ")}` : `bis ${formatShortDate(new Date(cycle.endsAt.getTime() - 1))}`}</span>
    </div>
  );
}

/**
 * MO–SO with today lit and the bar filled up to today (the middle of its column). No deadline marker –
 * the time on the right says it. Longer rounds show dates and fill by the hour.
 */
function WeekBar({ cycle, now }: { cycle: NonNullable<Overview["cycle"]>; now: Date }) {
  const start = DateTime.fromJSDate(cycle.startsAt, { zone: APP_TIMEZONE }).setLocale("de");
  const span = cycle.endsAt.getTime() - cycle.startsAt.getTime();
  const days = Math.round(span / 86_400_000);
  const today = DateTime.fromJSDate(now, { zone: APP_TIMEZONE });
  const daily = days <= 8;
  const labels = daily
    ? Array.from({ length: days }, (_, i) => {
        const d = start.plus({ days: i });
        return { text: d.toFormat("ccc").replace(".", "").slice(0, 2).toUpperCase(), now: d.hasSame(today, "day") };
      })
    : Array.from({ length: 5 }, (_, i) => ({ text: start.plus({ days: Math.round((i * (days - 1)) / 4) }).toFormat("d.M."), now: false }));
  const todayIndex = labels.findIndex((l) => l.now);
  const filled = daily
    ? todayIndex >= 0
      ? ((todayIndex + 0.5) / labels.length) * 100
      : now >= cycle.endsAt ? 100 : 0
    : Math.min(100, Math.max(0, ((now.getTime() - cycle.startsAt.getTime()) / span) * 100));
  return (
    <div data-week-bar className="mt-5" aria-label={`${periodLabel(cycle.startsAt, cycle.endsAt)}: Frist ${shortDeadline(cycle.deadlineAt)}`} role="img">
      <div className="grid text-center font-mono text-[11px] text-muted" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((l, i) => (
          <span key={i} className={l.now ? "font-bold text-accent-time" : undefined}>
            {l.text}
          </span>
        ))}
      </div>
      <div className="relative mt-2 h-1.5 rounded-[3px] bg-track">
        <div aria-hidden="true" className="absolute inset-y-0 left-0 rounded-[3px] bg-ink opacity-85" style={{ width: `${filled}%` }} />
      </div>
    </div>
  );
}

/**
 * What the flower thinks (Caveat, a tilted oval) and two dots leading to its head – positions from
 * HomeB.html in the flower's 300×420 box; sizes in container units (cqw), so it scales with the flower –
 * but never below 16 px text: on a small phone the bubble keeps 150 px and grows to the left.
 */
function ThoughtBubble({ text }: { text: string }) {
  return (
    <>
      <p
        data-speech
        className="animate-pop-in absolute left-[-9.7%] top-[1.9%] z-10 w-[max(58.7%,150px)] -translate-x-[max(0px,calc(150px-58.7cqw))] -rotate-[4deg] rounded-[40px/34px] bg-ink px-[max(5.3cqw,12px)] pb-[max(5.3cqw,12px)] pt-[max(4.7cqw,10px)] text-center font-hand text-[max(7.67cqw,16px)] font-semibold leading-[1.02] text-bg"
      >
        {text}
      </p>
      <span aria-hidden="true" className="absolute left-[48.3%] top-[23.3%] size-[4.67cqw] rounded-full bg-ink" />
      <span aria-hidden="true" className="absolute left-[53.7%] top-[28.6%] size-[2.67cqw] rounded-full bg-ink" />
    </>
  );
}

function viewFor(
  step: NextStep,
  { me, partner, date, swappable, o, now }: { me: User; partner: User; date?: DatePlan; swappable: boolean; o: Overview; now: Date },
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
        deadline: true,
        on: me,
        cta: (
          // "Date planen" and, round next to it, handing the turn over (HomeB.html).
          <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2">
            <Link href="/plan?pick=1" className={buttonClass("primary", "lg", "h-14 w-full")}>
              Date planen
            </Link>
            <form action={swapTurnAction.bind(null, partner.id)}>
              <button type="submit" aria-label={`Diesmal an ${partner.name} abgeben`} className="press flex size-14 items-center justify-center rounded-full bg-surface text-ink">
                <ArrowIcon width={20} height={20} />
              </button>
            </form>
          </div>
        ),
      };
    case "partner_turn":
      return {
        headline: `${partner.name.toLowerCase()} ist\ndran.`,
        deadline: true,
        on: partner,
        cta: (
          <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2">
            <NudgeButton />
            <form action={swapTurnAction.bind(null, me.id)}>
              <button type="submit" aria-label="Ich übernehme diesmal" className="press flex size-14 items-center justify-center rounded-full bg-surface text-ink">
                <SwapIcon width={20} height={20} />
              </button>
            </form>
          </div>
        ),
      };
    case "wait_confirm":
      return {
        headline: `${partner.name.toLowerCase()} ist\ndran.`,
        pill: date ? { when: shortWhen(date.startsAt), title: date.title } : undefined,
        on: partner,
        cta: (
          <>
            <NudgeButton />
            {details}
          </>
        ),
      };
    case "confirm":
      return {
        headline: `${partner.name.toLowerCase()} hat\ngegossen.`,
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
        headline: "date\nsteht.",
        sub: date && (
          <>
            {mine ? `${partner.name} hat zugesagt.` : "Du hast zugesagt."} Ihr seht euch {weekday(date.startsAt)}.
          </>
        ),
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
        cta: o.toReview && (
          <div className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
            <StartReview date={o.toReview} photoId={o.reviewPhoto} />
          </div>
        ),
      };
    case "suggestion":
      return {
        headline: "zeit für\nein date.",
        deadline: true,
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
        ? { headline: "diesmal\nwelk.", sub: `Kein Date diesmal – passiert. Weiter geht's am ${formatShortDate(o.cycle!.endsAt)}.`, cta: null }
        : { headline: "geschafft.", sub: `Weiter geht's am ${formatShortDate(o.cycle!.endsAt)}.`, cta: null };
    case "connect_calendar":
    case "partner_calendar":
      return { headline: "fast\nstartklar.", cta: null };
  }
  void now;
}

/** MEinladung: when, where, what (and the note) – what the other one has planned. */
function Invitation({ date, partner, surprise }: { date: DatePlan; partner: User; surprise: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 py-3">
      <Bloom stimmung="wartet" blaetter={3} className="mx-auto h-[clamp(72px,17vh,160px)] w-auto" />
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
