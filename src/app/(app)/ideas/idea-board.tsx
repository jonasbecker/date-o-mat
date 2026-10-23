"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import type { CategoryKind } from "@/core/idea-category";
import type { NextDateInfo } from "@/components/swap-confirm";
import { IdeaForm, type IdeaFormDefaults } from "@/components/idea-form";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { TicketIcon } from "@/components/icons";
import { QuickAdd } from "@/components/quick-add";
import { IdeaDetail } from "./idea-detail";
import { IdeaTiles, type TileCounts } from "./idea-tiles";
import type { Illustration } from "@/core/card-art";
import type { IdeaTimes } from "@/core/idea-category";
import { CategoryView } from "./category-view";
import type { UserColor } from "@/lib/domain";
import { archiveIdeaAction, updateIdeaAction } from "./actions";

export type BoardPerson = { name: string; color: UserColor | null };
export type BoardIdea = IdeaFormDefaults & {
  id: string;
  createdById: string | null;
  updatedById: string | null;
  matched: boolean;
  source: string;
  /** The pastel and the drawing (stored, or core/card-art.ts by category). */
  hex: string;
  illustration: Illustration;
  likedBy: string[];
  lastPlannedAt: number | null;
  createdAt: number;
};
/** The next date – an idea can take its place. */
export type BoardNextDate = NextDateInfo & { ideaId: string | null; swappable: boolean };

export function IdeaBoard({
  ideas: allIdeas,
  people,
  next,
  canPlanNew,
  partnerName,
  meId,
  partnerId,
  times,
  now,
  view,
  ideaId,
  listHref,
}: {
  ideas: BoardIdea[];
  people: Record<string, BoardPerson>;
  partnerName: string;
  next: BoardNextDate | null;
  /** The round has no date yet – "Date damit planen" works. */
  canPlanNew: boolean;
  meId: string;
  partnerId: string;
  /** A tile's view: the free times per idea (streamed). */
  times: Promise<IdeaTimes> | null;
  now: number;
  /** "tiles": the overview of MIdeen; a view: its list (the page URL decides, so the Ideen tab brings you back). */
  view: CategoryKind | "tiles";
  /** `?idee=<id>`: this idea on the whole screen. */
  ideaId?: string;
  /** The list this page shows (`/ideas?ansicht=alle`) – where the detail goes back to. */
  listHref: string;
}) {
  const router = useRouter();
  // A deleted idea leaves the list at once – before the server answers.
  const [ideas, hideIdea] = useOptimistic(allIdeas, (current, id: string) => current.filter((i) => i.id !== id));
  const [open, setOpen] = useState<{ idea: BoardIdea; view: "edit" } | null>(null);
  const [, startDelete] = useTransition();
  const sheet = useRef<SheetHandle>(null);

  // Ideas that came from swiping say who liked them.
  const tagOf = (idea: BoardIdea): string | null =>
    idea.source !== "deck" ? null : idea.createdById === meId ? "💚 von dir geswipt" : `💚 ${people[idea.createdById ?? ""]?.name ?? "Ihr"} hat's geliked`;
  const matches = ideas.filter((idea) => idea.matched);
  const counts = Object.fromEntries((["small", "large", "outdoor", "indoor", "local", "own"] as const).map((v) => [v, ideas.filter((i) => inView(i, v)).length])) as TileCounts;

  // Tapping an idea opens it on the whole screen (in the URL, so "back" works like everywhere).
  const detailHref = (id: string) => `${listHref}${listHref.includes("?") ? "&" : "?"}idee=${id}`;
  function edit(idea: BoardIdea) {
    setOpen({ idea, view: "edit" });
    sheet.current?.open();
  }
  function remove(id: string) {
    sheet.current?.close();
    router.replace(listHref);
    startDelete(async () => {
      hideIdea(id);
      await archiveIdeaAction(id);
    });
  }

  const editSheet = (
    <Sheet ref={sheet} title="Idee bearbeiten" onClose={() => setOpen(null)}>
      {open && (
        <IdeaForm
          key={open.idea.id}
          action={updateIdeaAction}
          idea={open.idea}
          onSaved={() => sheet.current?.close()}
          onDelete={async () => remove(open.idea.id)}
          footnote={footnote(open.idea, people)}
        />
      )}
    </Sheet>
  );

  const detail = ideaId ? ideas.find((i) => i.id === ideaId) : undefined;
  if (detail) {
    return (
      <>
        <IdeaDetail
          idea={detail}
          backHref={listHref}
          next={next}
          canPlanNew={canPlanNew}
          partnerName={partnerName}
          tag={tagOf(detail)}
          footnote={footnote(detail, people)}
          onEdit={() => edit(detail)}
          onDelete={() => remove(detail.id)}
        />
        {editSheet}
      </>
    );
  }

  if (view === "tiles") {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <h1 className="headline text-[54px]">ideen.</h1>
          <span className="flex items-center gap-3 pb-1 text-sm font-bold">
            <Link href="/ideas?ansicht=alle" className="tap hit">
              Alle {ideas.length} ›
            </Link>
            {/* Events in town: a real pill, not a small link (it is half of what to do). */}
            <Link href="/events" className="tap inline-flex h-11 items-center gap-1.5 rounded-full bg-surface px-4">
              <TicketIcon width={16} height={16} aria-hidden="true" /> Was läuft
            </Link>
          </span>
        </div>
        <QuickAdd look="field" />
        <IdeaTiles counts={counts} matches={matches} onView={(v) => router.push(`/ideas?ansicht=${v}`)} />
      </div>
    );
  }

  const couple = [meId, partnerId].map((id) => ({ id, name: people[id]?.name ?? "", color: people[id]?.color ?? null }));
  return (
    <>
      <CategoryView
        key={view}
        kind={view}
        ideas={ideas.filter((idea) => inView(idea, view, meId))}
        people={couple}
        partnerId={partnerId}
        times={times ?? NO_TIMES}
        now={now}
        // Like the idea's own page: a new date starts the flow at "wann?"; the round's date taken, the page offers the swap.
        planHref={(id, start) => (canPlanNew && next?.ideaId !== id ? `/plan?idea=${id}${start ? `&start=${encodeURIComponent(start)}` : ""}` : detailHref(id))}
        detailHref={detailHref}
      />
      {editSheet}
    </>
  );
}

const NO_TIMES: Promise<IdeaTimes> = Promise.resolve({ calendars: false, slots: {} });

function inView(idea: BoardIdea, view: CategoryKind, meId?: string): boolean {
  switch (view) {
    case "all":
      return true;
    case "match":
      return idea.matched;
    case "swiped":
      // "Meine Likes": what I swiped right (and the matches) – the other one's likes stay theirs.
      return idea.source === "deck" && (idea.createdById === meId || idea.matched);
    case "small":
    case "large":
      return idea.size === view;
    case "outdoor":
    case "indoor":
      return idea.setting === view;
    case "local":
      return Boolean(idea.location);
    case "own":
      return idea.source === "wishlist";
  }
}

/** What tapping an idea offers: plan it (or do it instead of the next date) – or edit it. */
function footnote(idea: BoardIdea, people: Record<string, BoardPerson>): string | undefined {
  const creator = idea.createdById ? people[idea.createdById]?.name : undefined;
  const editor = idea.updatedById ? people[idea.updatedById]?.name : undefined;
  if (!creator) return undefined;
  return editor && editor !== creator ? `Eingetragen von ${creator} · zuletzt geändert von ${editor}` : `Eingetragen von ${creator}`;
}
