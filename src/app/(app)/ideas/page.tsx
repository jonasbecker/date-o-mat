import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader, HeaderMeta, PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { listIdeas, matchedIdeaIds } from "@/server/ideas";
import { getCoupleSettings } from "@/server/settings";
import { IdeaBoard, type BoardIdea, type BoardNextDate, type BoardPerson } from "./idea-board";

/** MIdeen: the field for your own ideas, the matches and the kinds of dates as tiles – a tap opens the list. */
export default function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Suspense
        fallback={
          <>
            <AppHeader />
            <PageSkeleton />
          </>
        }
      >
        <Ideas searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Ideas({ searchParams }: { searchParams: PageProps<"/ideas">["searchParams"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  // "Meine Likes" on the swipe page lands here with the swiped ideas selected.
  const { ansicht } = await searchParams;
  const VIEWS = { geswipt: "swiped", match: "match", alle: "all", small: "small", large: "large", outdoor: "outdoor", indoor: "indoor", local: "local", own: "own" } as const;
  const view = typeof ansicht === "string" && ansicht in VIEWS ? VIEWS[ansicht as keyof typeof VIEWS] : "tiles";
  const now = coupleNow(await getCoupleSettings(coupleId));
  const [ideas, matched, cycle, upcoming] = await Promise.all([listIdeas(coupleId), matchedIdeaIds(coupleId), ensureCurrentCycle(coupleId, now), upcomingDate(coupleId, now)]);
  // Tapping an idea offers to plan it – or, with a date ahead, to do this instead.
  const shown = upcoming && dateForViewer(upcoming, user.id, [user, partner], now);
  const next: BoardNextDate | null = shown
    ? {
        id: shown.id,
        title: shown.title,
        when: `${formatShortDate(shown.startsAt)}, ${formatTimeRange(shown.startsAt, shown.endsAt)}`,
        size: shown.size,
        // Someone else's surprise is theirs to change – and its idea stays unmarked.
        ideaId: shown === upcoming ? shown.ideaId : null,
        swappable: shown === upcoming,
      }
    : null;

  const people: Record<string, BoardPerson> = Object.fromEntries(
    [user, partner].map((person) => [person.id, { name: person.name, color: person.color }]),
  );
  const boardIdeas: BoardIdea[] = ideas.map((idea) => ({
    id: idea.id,
    title: idea.title,
    size: idea.size,
    note: idea.note,
    url: idea.url,
    costEur: idea.costEur,
    location: idea.location,
    setting: idea.setting,
    category: idea.category,
    source: idea.source,
    createdById: idea.createdById,
    updatedById: idea.updatedById,
    matched: matched.has(idea.id),
  }));

  return (
    <>
      <AutoRefresh />
      <AppHeader action={<HeaderMeta>{ideas.length} Ideen</HeaderMeta>} />
      <IdeaBoard ideas={boardIdeas} people={people} next={next} canPlanNew={!next || cycle?.status === "open"} partnerName={partner.name} meId={user.id} view={view} />
    </>
  );
}
