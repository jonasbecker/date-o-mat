// The big card at the top of the home screen: exactly one thing to do (or to know).
import Link from "next/link";
import { confirmDateAction, swapTurnAction } from "@/app/(app)/actions";
import { periodLabel, type NextStep } from "@/core/next-step";
import type { UserColor } from "@/lib/domain";
import { daysUntilLabel, formatCycleRange, formatDeadline, formatShortDate, formatTimeRange, genitive, shortDeadline, timeLeftLabel } from "@/lib/format";
import type { Cycle, DatePlan, User } from "@/server/db/schema";
import { cn } from "@/lib/cn";
import { buttonClass } from "./button";
import { Card, Chip, type CardTone } from "./card";
import { ConfettiActionButton } from "./confetti";
import { connectCalendarHref } from "./connect-calendar";
import { CycleStepper } from "./cycle";
import { CalendarIcon, ClockIcon, SparkleIcon } from "./icons";

/** Steps that ask for an action – the others just tell you where things stand. */
const ACTIONABLE = new Set<NextStep["kind"]>(["connect_calendar", "plan", "suggestion", "confirm", "review"]);
/** Steps that still wait for a plan – the compact card names the deadline. */
const WITH_DEADLINE = new Set<NextStep["kind"]>(["plan", "suggestion", "partner_turn"]);
import { Info } from "./info";

const PERSON_TONE: Record<UserColor, CardTone> = { mandarine: "mandarine", himmel: "himmel" };

function tone(step: NextStep, me: User, partner: User): CardTone {
  switch (step.kind) {
    case "plan":
      return PERSON_TONE[me.color ?? "mandarine"];
    case "partner_turn":
      return PERSON_TONE[partner.color ?? "himmel"];
    case "confirm":
    case "wait_confirm":
    case "connect_calendar":
    case "partner_calendar":
      return "zitrone";
    case "suggestion":
    case "review":
      return "lavendel";
    case "date_ahead":
      return "minze";
    case "round_done":
      return step.skipped ? "surface" : "minze";
  }
}

/** One line – the full date card with all details sits right below on the home screen. */
function DateLine({ date, now }: { date: DatePlan; now: Date }) {
  return (
    <p className="font-bold">
      „{date.title}“ · {formatShortDate(date.startsAt)} ({daysUntilLabel(now, date.startsAt)}), {formatTimeRange(date.startsAt, date.endsAt)} Uhr
    </p>
  );
}

function Deadline({ cycle, now }: { cycle: Cycle; now: Date }) {
  if (cycle.deadlineAt <= now) {
    return (
      <p className="font-bold">„Plan bis“ ist vorbei – bis {formatShortDate(new Date(cycle.endsAt.getTime() - 1))} geht aber noch was!</p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-2 font-bold">
      <ClockIcon width={20} height={20} />
      <span>
        Plan bis <strong className="font-extrabold">{formatDeadline(cycle.deadlineAt)}</strong>
      </span>
      <span className="rounded-full border-2 border-line bg-zitrone px-2 py-px text-xs font-extrabold text-tinte">{timeLeftLabel(now, cycle.deadlineAt)}</span>
      <Info term="frist" />
    </p>
  );
}

export function NextStepCard({
  step,
  cycle,
  me,
  partner,
  now,
  date,
  onPlanPage = false,
  note,
  children,
}: {
  step: NextStep;
  cycle: Cycle;
  me: User;
  partner: User;
  now: Date;
  /** The upcoming date (for confirm / wait / date ahead). */
  date?: DatePlan;
  /** On the start page (the planning flow): compact – the date itself sits in a summary below. */
  onPlanPage?: boolean;
  /** A short extra line that belongs to this round (e.g. last time was skipped) – same box, no extra card. */
  note?: React.ReactNode;
  /** On the start page: what belongs into this box (the date, the proposal). */
  children?: React.ReactNode;
}) {
  let title: string;
  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;

  switch (step.kind) {
    case "connect_calendar":
      title = step.reauth ? "Kalender neu verbinden" : "Verbinde deinen Kalender";
      body = (
        <p className="font-bold">
          {step.reauth
            ? "Google hat die Verbindung beendet (z. B. nach einer Passwortänderung). Ein Tipp, und es läuft wieder."
            : "Damit der Date-O-Mat eure gemeinsamen freien Zeiten findet. Er sieht nur „frei“ oder „belegt“ – nie deine Termine."}
        </p>
      );
      // Plain <a>: the route handler redirects to Google.
      actions = (
        <a href={connectCalendarHref("/")} className={buttonClass("primary", "lg", "w-full")}>
          <CalendarIcon /> Kalender verbinden
        </a>
      );
      break;
    case "partner_calendar":
      title = "Gleich geht's los";
      body = <p className="font-bold">{partner.name} muss noch den Kalender verbinden – dann findet der Date-O-Mat eure gemeinsamen Lücken.</p>;
      break;
    case "plan":
      title = "Du bist dran!";
      body = !onPlanPage && (
        <>
          <Deadline cycle={cycle} now={now} />
          <p className="flex items-center gap-2 text-sm font-bold">
            Du suchst Termin und Idee aus, {partner.name} sagt „Passt!“. <Info term="abwechselnd" />
          </p>
        </>
      );
      actions = (
        <div className="flex flex-col items-center gap-2">
          {/* The flow starts here: the wishlist, then the time. */}
          <Link href="/plan?pick=1" className={buttonClass("primary", onPlanPage ? "md" : "lg", "w-full")}>
            <SparkleIcon /> Date planen
          </Link>
          <form action={swapTurnAction}>
            <button type="submit" className="text-sm font-extrabold underline">
              Diesmal an {partner.name} abgeben
            </button>
          </form>
        </div>
      );
      break;
    case "suggestion":
      title = "Zeit für ein Date!";
      // On the start page the proposal itself sits in this box.
      body = !onPlanPage && (
        <>
          <Deadline cycle={cycle} now={now} />
          <p className="flex items-center gap-2 font-bold">
            Der Date-O-Mat hat einen Vorschlag für euch – gleich hier drunter. <Info term="vorschlag" />
          </p>
        </>
      );
      break;
    case "confirm":
      title = `${partner.name} hat ein Date geplant 🎉`;
      body = date && (
        <>
          {!onPlanPage && <DateLine date={date} now={now} />}
          {!onPlanPage && (
            <p className="flex items-center gap-2 font-bold">
              Passt dir das? <Info term="passt" />
            </p>
          )}
        </>
      );
      actions = !onPlanPage && (
        <div className="flex flex-col items-center gap-2">
          <ConfettiActionButton action={confirmDateAction.bind(null, step.dateId)} className="w-full">
            Passt! 💚
          </ConfettiActionButton>
          {!onPlanPage && (
            <Link href={`/plan?reschedule=${step.dateId}`} className="text-sm font-extrabold underline">
              Anderen Termin vorschlagen
            </Link>
          )}
        </div>
      );
      break;
    case "wait_confirm":
      title = `Wartet auf ${genitive(partner.name)} „Passt!“`;
      body = date && (
        <>
          {!onPlanPage && <DateLine date={date} now={now} />}
          {!onPlanPage && <p className="font-bold">{partner.name} hat Bescheid bekommen und bestätigt in der App oder über die Google-Einladung.</p>}
        </>
      );
      break;
    case "date_ahead":
      title = "Date steht! 🎉";
      body = date && !onPlanPage && <DateLine date={date} now={now} />;
      break;
    case "review":
      title = "Wie war's?";
      body = <p className="font-bold">„{step.title}“ – vergib ein paar Herzen und halt fest, was schön war.</p>;
      actions = (
        <Link href={`/dates/${step.dateId}`} className={buttonClass("primary", onPlanPage ? "md" : "lg", "w-full")}>
          💭 Jetzt bewerten
        </Link>
      );
      break;
    case "partner_turn":
      title = `${partner.name} ist dran`;
      body = (
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {onPlanPage ? `${partner.name} plant diesmal – du kannst auch einspringen.` : `${partner.name} plant diesmal (bis ${formatDeadline(cycle.deadlineAt)}). Du kannst schon Ideen sammeln – oder einspringen.`}
          {!onPlanPage && <Info term="abwechselnd" />}
        </p>
      );
      actions = (
        <div className="flex flex-wrap items-center gap-3">
          {!onPlanPage && (
            <Link href="/ideas" className={buttonClass("secondary", "sm")}>
              💡 Ideen sammeln
            </Link>
          )}
          <form action={swapTurnAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Ich übernehme diesmal
            </button>
          </form>
        </div>
      );
      break;
    case "round_done":
      title = step.skipped ? `${periodLabel(cycle.startsAt, cycle.endsAt)} ist vorbei` : "Geschafft 💚";
      body = (
        <p className="font-bold">
          {step.skipped ? "Kein Date diesmal – passiert. " : ""}Weiter geht&apos;s am {formatShortDate(cycle.endsAt)}.
        </p>
      );
      break;
  }

  return (
    <Card
      data-next-step={step.kind}
      tone={tone(step, me, partner)}
      size={onPlanPage ? "sm" : "lg"}
      flat={onPlanPage}
      className={cn("animate-pop-in relative flex flex-col overflow-hidden", onPlanPage ? "gap-2 text-sm" : "gap-3.5")}
    >
      {onPlanPage ? (
        // One line instead of chips, deadline and countdown – the start page has little room.
        <p className="text-[13px] font-extrabold opacity-80">
          {periodLabel(cycle.startsAt, cycle.endsAt)}
          {WITH_DEADLINE.has(step.kind) && (cycle.deadlineAt > now ? ` · Plan bis ${shortDeadline(cycle.deadlineAt)} · ${timeLeftLabel(now, cycle.deadlineAt)}` : ` · Geht noch bis ${formatShortDate(new Date(cycle.endsAt.getTime() - 1))}`)}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Chip className="bg-bg">{periodLabel(cycle.startsAt, cycle.endsAt)}</Chip>
          <Chip className="bg-bg">{formatCycleRange(cycle.startsAt, cycle.endsAt)}</Chip>
        </div>
      )}
      {!onPlanPage && (
        <p className="-mb-2 text-[13px] font-extrabold uppercase tracking-wide opacity-80">
          {ACTIONABLE.has(step.kind) ? "Dein nächster Schritt" : "Stand der Dinge"}
        </p>
      )}
      {onPlanPage ? (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[24px] font-bold leading-[1.1]">{title}</h2>
          {/* The one ⓘ on the start page: what "Plan bis" means. */}
          {WITH_DEADLINE.has(step.kind) && <Info term="frist" />}
        </div>
      ) : (
        <h2 className="text-[38px] font-bold leading-[1.05]">{title}</h2>
      )}
      {body}
      {children}
      {note && <p className="font-bold">{note}</p>}
      {actions}
      {!onPlanPage && <CycleStepper status={cycle.status === "skipped" ? "open" : cycle.status} />}
    </Card>
  );
}
