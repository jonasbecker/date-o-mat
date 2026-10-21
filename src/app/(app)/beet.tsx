// The Beet (docs/design/main-b: Main Page B; DESIGN.md MBeetSie, MEinladung, MBestaetigt): the start page.
// A big lowercase headline says whose turn it is, the time left stands big on the right, a bar shows
// the round and its deadline, the flower (core/bloom.ts) shows the mood and thinks out loud, and there
// is one thing to do – "Date planen", "Anstupsen", "Zusagen" or "Wie war's?".
import Link from "next/link";
import { DateTime } from "luxon";
import { cancelDateAction, confirmDateAction, didItAction, swapTurnAction } from "./actions";
import { CancelDateButton } from "@/components/cancel-date-button";
import { Avatar } from "@/components/avatar";
import { buttonClass } from "@/components/button";
import { ConfettiActionButton } from "@/components/confetti";
import { NudgeButton } from "@/components/nudge-button";
import { Bloom } from "@/components/bloom";
import { FlowerVoice } from "@/components/flower-voice";
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
import { DateSheet } from "./date-sheet";
import { routeUrl } from "@/core/date-extras";

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
/** "heute abend" / "morgen" / "Freitag" – a weekday alone reads like next week when it is today. */
function seeWhen(d: Date, now: Date) {
  const day = DateTime.fromJSDate(d, { zone: APP_TIMEZONE });
  const today = DateTime.fromJSDate(now, { zone: APP_TIMEZONE }).startOf("day");
  const diff = day.startOf("day").diff(today, "days").days;
  if (diff === 0) return day.hour >= 17 ? "heute abend" : "heute";
  if (diff === 1) return "morgen";
  return weekday(d);
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
  const saying = bloomSaying(stimmung, dayOfYear, { partner: partner.name, day: date ? weekday(date.startsAt) : undefined, missed, turn: onTurn ?? undefined });

  const headline = (
    <h2 className="headline mt-2 whitespace-pre-line font-extrabold leading-[0.9] tracking-[-0.055em]" style={{ fontSize: `${size}px` }}>
      {view.headline}
    </h2>
  );

  // "date steht.": the card is a sheet you pull up, the flower gets pushed out of the way (date-sheet.tsx).
  if (step.kind === "date_ahead" && date) {
    return (
      <div data-next-step={step.kind} className="flex min-h-0 flex-1 flex-col">
        <DateSheet
          headline={headline}
          above={
            <>
              <WeekBar cycle={cycle} now={now} />
              {view.sub && <div className="mt-3 text-[15px] text-muted">{view.sub}</div>}
              {date.syncStatus === "error" && (
                <p role="status" className="mt-3 rounded-[18px] bg-zitrone-soft px-3.5 py-2 text-sm text-tinte">
                  Google Kalender hakt gerade – Zweisamen versucht es nochmal.
                </p>
              )}
              {notices && <div className="mt-3 flex flex-col gap-2">{notices}</div>}
            </>
          }
          head={<SheetHead date={date} />}
          details={<SheetDetails date={date} me={me} partner={partner} o={o} swappable={swappable} />}
          saying={saying}
          voice={{ publicKey: o.push.publicKey, myDevices: o.push.mine, partnerDevices: o.push.partner, partnerName: partner.name }}
          bloom={{ blaetter, welk, pot: pot ?? "terrakotta" }}
        />
      </div>
    );
  }

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
          Google Kalender hakt gerade – Zweisamen versucht es nochmal.
        </p>
      )}
      {notices && <div className="mt-3 flex flex-col gap-2">{notices}</div>}
      {view.invitation && date ? (
        <Invitation date={date} partner={partner} surprise={o.dateExtras?.surprise === "hidden"} />
      ) : (
        // One flower size for every step (capped); it only gets smaller when a step needs the room.
        <div className="relative my-auto min-h-28 w-full flex-1 basis-0 max-h-[min(40svh,340px)]" data-onturn={onTurn ?? undefined}>
          {/* The flower box keeps the mockup's 300×420 proportions; the bubble sits by its head. */}
          <div className="absolute bottom-0 left-1/2 top-2 aspect-[300/420] max-w-full -translate-x-1/2 [container-type:size]">
            <Bloom stimmung={stimmung} blaetter={blaetter} welk={welk} topf={pot} className="absolute inset-0 size-full" />
            <FlowerVoice text={saying} publicKey={o.push.publicKey} myDevices={o.push.mine} partnerDevices={o.push.partner} partnerName={partner.name} />
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

/** A date already planned for a later round, shown while this round is still to plan: "Sa 31.10. 18:30". */
function aheadPill(date: DatePlan | undefined) {
  if (!date) return undefined;
  const start = DateTime.fromJSDate(date.startsAt, { zone: APP_TIMEZONE }).setLocale("de");
  const when = `${start.toFormat("ccc").replace(".", "")} ${start.toFormat("d.M. HH:mm")}`;
  return { when: `danach ${when}`, title: date.title };
}

function viewFor(
  step: NextStep,
  { me, partner, date, swappable, o, now }: { me: User; partner: User; date?: DatePlan; swappable: boolean; o: Overview; now: Date },
): View {
  const details = date && (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm font-semibold">
      <Link href={`/dates/${date.id}`} className="hit underline">
        Details ›
      </Link>
      {o.dateExtras?.isToday && (
        <Link href="/fragen" className="hit underline">
          💬 Gesprächskarten
        </Link>
      )}
      {swappable && (
        <Link href="/plan?pick=1" className="hit flex items-center gap-1.5 underline">
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
        pill: aheadPill(date),
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
        pill: aheadPill(date),
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
      // You watered – now only the other one's "Zusagen" is missing.
      return {
        headline: `wartet auf\n${partner.name.toLowerCase()}.`,
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
            <ConfettiActionButton action={confirmDateAction.bind(null, date.id, date.startsAt.toISOString())} variant="primary" className="w-full">
              Zusagen
            </ConfettiActionButton>
            <Link href={`/plan?reschedule=${date.id}`} className={buttonClass("secondary", "lg", "w-full")}>
              Anderer Termin
            </Link>
            {/* Can't or won't: say so instead of inventing another time. */}
            <span className="flex items-center justify-center gap-x-4">
              <CancelDateButton action={cancelDateAction.bind(null, date.id)} partnerName={partner.name} />
            </span>
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
            {mine ? `${partner.name} hat zugesagt.` : "Du hast zugesagt."} Ihr seht euch {seeWhen(date.startsAt, now)}.
          </>
        ),
        // The card itself is the control (date-sheet.tsx) – no button below.
        cta: null,
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
    case "did_it":
      return {
        headline: "habt ihr's\ngemacht?",
        sub: o.unanswered && `„${o.unanswered.title}“, ${formatShortDate(o.unanswered.startsAt)} – zugesagt hatte noch niemand. Zählt nur, wenn ihr's gemacht habt.`,
        cta: (
          <div data-did-it className="grid grid-cols-2 gap-2">
            <form action={didItAction.bind(null, step.dateId, true)}>
              <button type="submit" className={buttonClass("primary", "lg", "h-14 w-full")}>
                Ja, haben wir
              </button>
            </form>
            <form action={didItAction.bind(null, step.dateId, false)}>
              <button type="submit" className={buttonClass("secondary", "lg", "h-14 w-full")}>
                Nein
              </button>
            </form>
          </div>
        ),
      };
    case "round_done":
      return step.skipped
        ? { headline: "diesmal\nwelk.", sub: `Kein Date diesmal – passiert. Weiter geht's am ${formatShortDate(o.cycle!.endsAt)}.`, cta: null }
        : { headline: "geschafft.", sub: `Weiter geht's am ${formatShortDate(o.cycle!.endsAt)}.`, cta: null };
    case "connect_calendar":
      return { headline: "fast\nstartklar.", cta: null };
    case "partner_calendar":
      // Your turn, but without the other calendar no free evening can be found: nudge, or hand over.
      return {
        headline: "fast\nstartklar.",
        sub: `${partner.name} muss den Kalender noch verbinden – erst dann findet Zweisamen eure freien Abende.`,
        cta: (
          <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2">
            <NudgeButton calendar />
            {o.cycle?.mode === "alternating" && (
              <form action={swapTurnAction.bind(null, partner.id)}>
                <button type="submit" aria-label={`Diesmal an ${partner.name} abgeben`} className="press flex size-14 items-center justify-center rounded-full bg-surface text-ink">
                  <ArrowIcon width={20} height={20} />
                </button>
              </form>
            )}
          </div>
        ),
      };
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

/** The closed card (MBestaetigt): title, time and place, the calendar chip. */
/** The closed card: only the title and when · where. */
function SheetHead({ date }: { date: DatePlan }) {
  return (
    <div data-date-card={date.id} className="flex flex-col gap-2.5">
      <p className="text-[21px] font-extrabold leading-[1.12] tracking-[-0.02em]">{date.title}</p>
      <p className="text-[15px] text-muted">
        {formatShortDate(date.startsAt)} · {formatTimeRange(date.startsAt, date.endsAt)}
        {date.location ? ` · ${date.location}` : ""}
      </p>
    </div>
  );
}

const ROW_LABEL = "meta pt-0.5 text-[11px] uppercase text-muted";

/** The card pulled up: the calendar chip, where (a drawn map that opens the route), what to bring, the note – then Route, Verschieben, Absagen. */
function SheetDetails({ date, me, partner, o, swappable }: { date: DatePlan; me: User; partner: User; o: Overview; swappable: boolean }) {
  const route = date.location ? routeUrl(date.location, me.startLocation) : null;
  const tasks = o.dateExtras?.tasks ?? null;
  const fromPartner = date.proposedById === partner.id;
  const surprise = o.dateExtras?.surprise ?? null;
  const noteLabel = surprise === "hidden" ? "HINWEIS" : fromPartner ? `VON ${partner.name.toUpperCase()}` : "DEINE NOTIZ";
  return (
    <>
      {surprise === "hidden" && <p className="text-[15px] text-muted">🤫 Eine Überraschung von {partner.name}</p>}
      {surprise === "organizer" && <p className="text-[15px] text-muted">🎁 {partner.name} sieht bis zum Tag nur die Zeit.</p>}
      {date.syncStatus === "synced" && <span className="inline-flex h-[30px] items-center self-start rounded-full bg-soft px-3 text-[13px] font-semibold">✓ in beiden Kalendern</span>}
      {route && (
        <a href={route} target="_blank" rel="noopener noreferrer" aria-label={`Route zu ${date.location}`} className="relative mt-1 block h-32 overflow-hidden rounded-[18px] bg-soft">
          <span aria-hidden="true" className="absolute -left-5 top-[70px] h-3.5 w-[420px] -rotate-[8deg] bg-[#2F4036]" />
          <span aria-hidden="true" className="absolute -top-2.5 left-[140px] h-40 w-3.5 rotate-[14deg] bg-[#2F4036]" />
          <span aria-hidden="true" className="absolute left-[196px] top-10 size-[22px] -rotate-45 rounded-[50%_50%_50%_0] bg-like" />
          <span className="meta absolute bottom-2.5 left-3 text-[10px] text-muted">Treffpunkt: {date.location}</span>
        </a>
      )}
      <dl className="grid grid-cols-[84px_minmax(0,1fr)] gap-y-2 text-sm">
        {date.location && (
          <>
            <dt className={ROW_LABEL}>Treffpunkt</dt>
            <dd>{date.location}</dd>
          </>
        )}
        {tasks && (
          <>
            <dt className={ROW_LABEL}>Mitnehmen</dt>
            <dd>
              {tasks.length > 0 && (
                <span>
                  {tasks.map((t, i) => (
                    <span key={t.id} className={t.done ? "text-muted line-through" : undefined}>
                      {i > 0 && ", "}
                      {t.title}
                    </span>
                  ))}{" "}
                </span>
              )}
              <Link href={`/dates/${date.id}`} className="text-muted underline">
                {tasks.length > 0 ? "bearbeiten" : "Liste anlegen"}
              </Link>
            </dd>
          </>
        )}
        {date.note && (
          <>
            <dt className={ROW_LABEL}>{noteLabel}</dt>
            <dd className="font-hand text-[19px] leading-[1.05] text-butter">„{date.note}“</dd>
          </>
        )}
      </dl>
      <div className={cn("mt-1 grid gap-2", route ? "grid-cols-2" : "grid-cols-1")}>
        {route && (
          <a href={route} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "w-full")}>
            Route
          </a>
        )}
        <Link href={`/plan?reschedule=${date.id}`} className={buttonClass("secondary", "md", "w-full")}>
          Verschieben
        </Link>
      </div>
      <span className="self-center">
        <CancelDateButton action={cancelDateAction.bind(null, date.id)} partnerName={partner.name} />
      </span>
      {(swappable || o.dateExtras?.isToday) && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pb-1 text-sm font-semibold">
          {o.dateExtras?.isToday && (
            <Link href="/fragen" className="hit underline">
              💬 Gesprächskarten
            </Link>
          )}
          {swappable && (
            <Link href="/plan?pick=1" className="hit flex items-center gap-1.5 underline">
              <SwapIcon width={15} height={15} /> Lieber was anderes?
            </Link>
          )}
        </div>
      )}
    </>
  );
}
