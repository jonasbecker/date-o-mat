// The big card at the top of the home screen: exactly one thing to do (or to know).
import Link from "next/link";
import { confirmDateAction, swapTurnAction } from "@/app/(app)/actions";
import { periodLabel, type NextStep } from "@/core/next-step";
import type { UserColor } from "@/lib/domain";
import { daysUntilLabel, formatCycleRange, formatDeadline, formatShortDate, formatTimeRange, genitive, timeLeftLabel } from "@/lib/format";
import type { Cycle, DatePlan, User } from "@/server/db/schema";
import { buttonClass } from "./button";
import { Card, Chip, type CardTone } from "./card";
import { ConfettiActionButton } from "./confetti";
import { connectCalendarHref } from "./connect-calendar";
import { CycleStepper } from "./cycle";
import { CalendarIcon, ClockIcon, SparkleIcon } from "./icons";

/** Steps that ask for an action – the others just tell you where things stand. */
const ACTIONABLE = new Set<NextStep["kind"]>(["connect_calendar", "plan", "suggestion", "confirm", "review"]);
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
      <p className="font-bold">Die Frist ist vorbei – bis {formatShortDate(new Date(cycle.endsAt.getTime() - 1))} geht aber noch was!</p>
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
}: {
  step: NextStep;
  cycle: Cycle;
  me: User;
  partner: User;
  now: Date;
  /** The upcoming date (for confirm / wait / date ahead). */
  date?: DatePlan;
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
      body = (
        <>
          <Deadline cycle={cycle} now={now} />
          <p className="flex items-center gap-2 text-sm font-bold">
            Du suchst Termin und Idee aus, {partner.name} sagt „Passt!“. <Info term="abwechselnd" />
          </p>
        </>
      );
      actions = (
        <div className="flex flex-col items-center gap-2">
          <Link href="/plan" className={buttonClass("primary", "lg", "w-full")}>
            <SparkleIcon /> Date planen
          </Link>
          <form action={swapTurnAction}>
            <button type="submit" className="text-sm font-extrabold underline">
              Diese Runde an {partner.name} abgeben
            </button>
          </form>
        </div>
      );
      break;
    case "suggestion":
      title = "Zeit für ein Date!";
      body = (
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
          <DateLine date={date} now={now} />
          <p className="flex items-center gap-2 font-bold">
            Passt dir das? <Info term="passt" />
          </p>
        </>
      );
      actions = (
        <div className="flex flex-col items-center gap-2">
          <ConfettiActionButton action={confirmDateAction.bind(null, step.dateId)} className="w-full">
            Passt! 💚
          </ConfettiActionButton>
          <Link href={`/plan?reschedule=${step.dateId}`} className="text-sm font-extrabold underline">
            Anderen Termin vorschlagen
          </Link>
        </div>
      );
      break;
    case "wait_confirm":
      title = `Wartet auf ${genitive(partner.name)} „Passt!“`;
      body = date && (
        <>
          <DateLine date={date} now={now} />
          <p className="font-bold">{partner.name} hat Bescheid bekommen und bestätigt in der App oder über die Google-Einladung.</p>
        </>
      );
      break;
    case "date_ahead":
      title = "Date steht! 🎉";
      body = date && <DateLine date={date} now={now} />;
      break;
    case "review":
      title = "Wie war's?";
      body = <p className="font-bold">„{step.title}“ – vergib ein paar Herzen und halt fest, was schön war.</p>;
      actions = (
        <Link href={`/dates/${step.dateId}`} className={buttonClass("primary", "lg", "w-full")}>
          💭 Jetzt bewerten
        </Link>
      );
      break;
    case "partner_turn":
      title = `${partner.name} ist dran`;
      body = (
        <p className="flex flex-wrap items-center gap-2 font-bold">
          {partner.name} plant diese Runde (bis {formatDeadline(cycle.deadlineAt)}). Du kannst schon Ideen sammeln – oder einspringen.
          <Info term="abwechselnd" />
        </p>
      );
      actions = (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/ideas" className={buttonClass("secondary", "sm")}>
            💡 Ideen sammeln
          </Link>
          <form action={swapTurnAction}>
            <button type="submit" className={buttonClass("secondary", "sm")}>
              Ich übernehme diese Runde
            </button>
          </form>
        </div>
      );
      break;
    case "round_done":
      title = step.skipped ? "Diese Runde ist vorbei" : "Runde geschafft 💚";
      body = (
        <p className="font-bold">
          {step.skipped ? "Kein Date diesmal – passiert. " : ""}Die nächste Runde startet {formatShortDate(cycle.endsAt)}.
        </p>
      );
      break;
  }

  return (
    <Card tone={tone(step, me, partner)} size="lg" className="animate-pop-in relative flex flex-col gap-3.5 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Chip className="bg-bg">{periodLabel(cycle.startsAt, cycle.endsAt)}</Chip>
        <Chip className="bg-bg">{formatCycleRange(cycle.startsAt, cycle.endsAt)}</Chip>
      </div>
      <p className="-mb-2 text-[13px] font-extrabold uppercase tracking-wide opacity-80">
        {ACTIONABLE.has(step.kind) ? "Dein nächster Schritt" : "Stand der Dinge"}
      </p>
      <h1 className="text-[38px] font-bold leading-[1.05]">{title}</h1>
      {body}
      {actions}
      <CycleStepper status={cycle.status === "skipped" ? "open" : cycle.status} />
    </Card>
  );
}
