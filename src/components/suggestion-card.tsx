import Link from "next/link";
import { acceptSuggestionAction, rejectSuggestionAction } from "@/app/(app)/actions";
import { formatCost } from "@/lib/idea-input";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import type { SuggestionRow } from "@/server/db/schema";
import type { SuggestionIdea } from "@/server/suggestions";
import { ConfettiActionButton } from "./confetti";
import { CalendarIcon } from "./icons";

/** The machine's proposal for this round (suggestion mode), inside the step card on the start page. */
export function SuggestionCard({ suggestion, idea }: { suggestion: SuggestionRow; idea: SuggestionIdea | null }) {
  const cost = idea ? formatCost(idea.costEur) : null;
  return (
    <>
      <div className="flex flex-col gap-1 font-bold" data-suggestion>
        <p className="text-[13px] font-extrabold opacity-80">Der Date-O-Mat schlägt vor</p>
        <p className="font-display text-[19px] font-semibold leading-tight">{idea ? idea.title : "Zeit zu zweit – die Idee sucht ihr spontan aus"}</p>
        <p className="flex items-center gap-2">
          <CalendarIcon width={17} height={17} /> {formatShortDate(suggestion.startsAt)} · {formatTimeRange(suggestion.startsAt, suggestion.endsAt)} Uhr
        </p>
        {(idea?.location || cost) && <p>{[idea?.location && `📍 ${idea.location}`, cost].filter(Boolean).join(" · ")}</p>}
      </div>
      <ConfettiActionButton action={acceptSuggestionAction.bind(null, suggestion.id)} variant="primary" size="md" className="w-full" goTo="/plan">
        Übernehmen 🎉
      </ConfettiActionButton>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <form action={rejectSuggestionAction.bind(null, suggestion.id)}>
          <button type="submit" className="font-extrabold underline">
            Anderer Vorschlag
          </button>
        </form>
        <Link href="/plan?pick=1" className="font-extrabold underline">
          Selbst aussuchen →
        </Link>
      </div>
    </>
  );
}
