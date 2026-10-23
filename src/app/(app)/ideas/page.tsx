import { connection } from "next/server";
import { AppHeader, HeaderMeta } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { formatShortDate, formatTimeRange } from "@/lib/format";
import { requireCouple } from "@/server/auth/dal";
import { coupleNow } from "@/server/clock";
import { ensureCurrentCycle } from "@/server/cycles";
import { dateForViewer, upcomingDate } from "@/server/dates";
import { listIdeas, matchedIdeaIds } from "@/server/ideas";
import { getCoupleSettings } from "@/server/settings";
import { cardArt } from "@/core/card-art";
import { ideaTimes, lastPlannedByIdea } from "@/server/idea-times";
import { IdeaBoard, type BoardIdea, type BoardNextDate, type BoardPerson } from "./idea-board";

/** MIdeen: the field for your own ideas, the matches and the kinds of dates as tiles – a tap opens the list. */
export default function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Ideas searchParams={searchParams} />
    </div>
  );
}

async function Ideas({ searchParams }: { searchParams: PageProps<"/ideas">["searchParams"] }) {
  const ctx = await requireCouple();
  const { user, partner, coupleId } = ctx;
  await connection();
  // "Meine Likes" on the swipe page lands here with the swiped ideas selected.
  const { ansicht, idee } = await searchParams;
  const VIEWS = { geswipt: "swiped", match: "match", alle: "all", small: "small", large: "large", outdoor: "outdoor", indoor: "indoor", local: "local", own: "own" } as const;
  const view = typeof ansicht === "string" && ansicht in VIEWS ? VIEWS[ansicht as keyof typeof VIEWS] : "tiles";
  const settings = await getCoupleSettings(coupleId);
  const now = coupleNow(settings);
  // A tile's view (not the shelf, not one idea): the flower's tip needs when each idea was last planned.
  const category = view !== "tiles" && typeof idee !== "string";
  const [ideas, matched, cycle, upcoming, lastPlanned] = await Promise.all([
    listIdeas(coupleId),
    matchedIdeaIds(coupleId),
    ensureCurrentCycle(coupleId, now, settings),
    upcomingDate(coupleId, now),
    category ? lastPlannedByIdea(coupleId) : new Map<string, Date>(),
  ]);
  // Its free times come from Google – streamed in, the page does not wait for them.
  const times = category ? ideaTimes(ctx, settings, now, ideas) : null;
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
  const boardIdeas: BoardIdea[] = ideas.map((idea) => {
    const art = cardArt(idea);
    return {
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
      hex: art.hex,
      illustration: art.illustrations[0],
      // A deck idea was liked by whoever swiped it; a match by both.
      likedBy: matched.has(idea.id) ? [user.id, partner.id] : idea.source === "deck" && idea.createdById ? [idea.createdById] : [],
      lastPlannedAt: lastPlanned.get(idea.id)?.getTime() ?? null,
      createdAt: idea.createdAt.getTime(),
    };
  });

  return (
    <>
      <AutoRefresh />
      {/* A tile's view has its own head (back, title, flower). */}
      {!category && <AppHeader action={<HeaderMeta>{ideas.length} Samen im Regal</HeaderMeta>} />}
      <IdeaBoard ideas={boardIdeas} people={people} next={next} canPlanNew={!next || cycle?.status === "open"} partnerName={partner.name} meId={user.id} partnerId={partner.id} times={times} now={now.getTime()} view={view} ideaId={typeof idee === "string" ? idee : undefined} listHref={typeof ansicht === "string" && ansicht in VIEWS ? `/ideas?ansicht=${ansicht}` : "/ideas?ansicht=alle"} />
    </>
  );
}
