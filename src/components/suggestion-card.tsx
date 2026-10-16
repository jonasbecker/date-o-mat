import Link from "next/link";
import { acceptSuggestionAction, rejectSuggestionAction } from "@/app/(app)/actions";
import { formatCost } from "@/lib/idea-input";
import { formatLongDate, formatTimeRange } from "@/lib/format";
import type { SuggestionRow } from "@/server/db/schema";
import type { SuggestionIdea } from "@/server/suggestions";
import { Button } from "./button";
import { Card } from "./card";
import { ConfettiActionButton } from "./confetti";
import { CalendarIcon, ClockIcon } from "./icons";
import { SizeChip } from "./size-chip";

/** The machine's proposal for this round (suggestion mode). */
export function SuggestionCard({ suggestion, idea }: { suggestion: SuggestionRow; idea: SuggestionIdea | null }) {
  const cost = idea ? formatCost(idea.costEur) : null;
  return (
    <Card className="flex flex-col gap-3.5">
      <p className="text-[13px] font-extrabold uppercase tracking-wide text-muted">Der Date-O-Mat schlägt vor</p>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[22px] font-bold leading-tight">{idea ? idea.title : "Zeit zu zweit – die Idee sucht ihr spontan aus"}</h2>
        <SizeChip size={suggestion.size} className="mt-1 shrink-0" />
      </div>
      <div className="flex flex-col gap-1.5 font-bold">
        <span className="flex items-center gap-2">
          <CalendarIcon width={18} height={18} /> {formatLongDate(suggestion.startsAt)}
        </span>
        <span className="flex items-center gap-2">
          <ClockIcon width={18} height={18} /> {formatTimeRange(suggestion.startsAt, suggestion.endsAt)} Uhr
        </span>
        {(idea?.location || cost) && (
          <span className="text-sm text-muted">{[idea?.location && `📍 ${idea.location}`, cost].filter(Boolean).join(" · ")}</span>
        )}
      </div>
      {!idea && (
        <p className="text-sm font-semibold text-muted">
          Auf eurer Wunschliste ist gerade keine passende Idee – tragt welche unter Ideen mit „+ Idee“ ein.
        </p>
      )}
      <ConfettiActionButton action={acceptSuggestionAction.bind(null, suggestion.id)} variant="primary" size="md" className="w-full" goTo="/dates">
        Übernehmen 🎉
      </ConfettiActionButton>
      <p className="-mt-1 text-center text-xs font-bold text-muted">Du wirst Organisator:in, die Einladung geht per Google raus.</p>
      <div className="flex flex-wrap items-center gap-3">
        <form action={rejectSuggestionAction.bind(null, suggestion.id)}>
          <Button type="submit" variant="secondary" size="sm">
            Anderer Vorschlag
          </Button>
        </form>
        <Link href="/plan" className="text-sm font-extrabold underline">
          Selbst Zeit aussuchen
        </Link>
      </div>
    </Card>
  );
}
