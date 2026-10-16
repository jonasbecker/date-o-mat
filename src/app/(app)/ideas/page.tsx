import { Suspense } from "react";
import { PageSkeleton } from "@/components/app-header";
import { AutoRefresh } from "@/components/auto-refresh";
import { IdeasTabs } from "@/components/ideas-tabs";
import { requireCouple } from "@/server/auth/dal";
import { listIdeas } from "@/server/ideas";
import { IdeaBoard, type BoardIdea, type BoardPerson } from "./idea-board";

export default function IdeasPage() {
  return (
    <div className="flex flex-col gap-4">
      <IdeasTabs current="wishlist" />
      <Suspense fallback={<PageSkeleton />}>
        <Ideas />
      </Suspense>
    </div>
  );
}

async function Ideas() {
  const { user, partner, coupleId } = await requireCouple();
  const ideas = await listIdeas(coupleId);

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
    createdById: idea.createdById,
    updatedById: idea.updatedById,
  }));

  return (
    <>
      <AutoRefresh />
      <IdeaBoard ideas={boardIdeas} people={people} />
    </>
  );
}
