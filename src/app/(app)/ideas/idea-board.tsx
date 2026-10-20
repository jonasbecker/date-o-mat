"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { FilteredEmpty, FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { categoryOf } from "@/core/categories";
import { matchesIdeaFilter } from "@/core/filters";
import type { ListView } from "@/components/category-chips";
import type { NextDateInfo } from "@/components/swap-confirm";
import { IdeaForm, type IdeaFormDefaults } from "@/components/idea-form";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { IdeaCard } from "@/components/idea-card";
import { BackIcon } from "@/components/icons";
import { QuickAdd } from "@/components/quick-add";
import { IdeaDetail } from "./idea-detail";
import { IdeaTiles, type TileCounts } from "./idea-tiles";
import { Mascot } from "@/components/mascot";
import type { UserColor } from "@/lib/domain";
import { archiveIdeaAction, updateIdeaAction } from "./actions";

export type BoardPerson = { name: string; color: UserColor | null };
export type BoardIdea = IdeaFormDefaults & { id: string; createdById: string | null; updatedById: string | null; matched: boolean; source: string };
/** The next date – an idea can take its place. */
export type BoardNextDate = NextDateInfo & { ideaId: string | null; swappable: boolean };

export function IdeaBoard({
  ideas: allIdeas,
  people,
  next,
  canPlanNew,
  partnerName,
  meId,
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
  /** "tiles": the overview of MIdeen; a view: its list (the page URL decides, so the Ideen tab brings you back). */
  view: ListView | "tiles";
  /** `?idee=<id>`: this idea on the whole screen. */
  ideaId?: string;
  /** The list this page shows (`/ideas?ansicht=alle`) – where the detail goes back to. */
  listHref: string;
}) {
  const router = useRouter();
  // A deleted idea leaves the list at once – before the server answers.
  const [ideas, hideIdea] = useOptimistic(allIdeas, (current, id: string) => current.filter((i) => i.id !== id));
  const [filter] = useIdeaFilter();
  const [open, setOpen] = useState<{ idea: BoardIdea; view: "edit" } | null>(null);
  const [, startDelete] = useTransition();
  const sheet = useRef<SheetHandle>(null);

  // Ideas that came from swiping say who liked them.
  const tagOf = (idea: BoardIdea): string | null =>
    idea.source !== "deck" ? null : idea.createdById === meId ? "💚 von dir geswipt" : `💚 ${people[idea.createdById ?? ""]?.name ?? "Ihr"} hat's geliked`;
  const matches = ideas.filter((idea) => idea.matched);
  const visible = ideas
    .filter((idea) => matchesIdeaFilter({ size: idea.size, costEur: idea.costEur, setting: idea.setting, category: categoryOf(idea) }, filter))
    .filter((idea) => view !== "tiles" && inView(idea, view));
  const counts = Object.fromEntries((["small", "large", "outdoor", "indoor", "local", "own"] as const).map((v) => [v, ideas.filter((i) => inView(i, v)).length])) as TileCounts;

  // Tapping an idea opens it on the whole screen (in the URL, so "back" works like everywhere).
  const detailHref = (id: string) => `${listHref}${listHref.includes("?") ? "&" : "?"}idee=${id}`;
  function show(idea: BoardIdea) {
    router.push(detailHref(idea.id));
  }
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
          <span className="flex items-center gap-3 pb-1.5 text-sm font-bold">
            <Link href="/events" className="tap">
              Was läuft ›
            </Link>
            <Link href="/ideas?ansicht=alle" className="tap">
              Alle {ideas.length} ›
            </Link>
          </span>
        </div>
        <QuickAdd look="field" />
        <IdeaTiles counts={counts} matches={matches} onView={(v) => router.push(`/ideas?ansicht=${v}`)} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <Link href="/ideas" aria-label="Zurück zu den Kacheln" className="tap flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
            <BackIcon width={18} height={18} />
          </Link>
          <h1 className="headline truncate text-[40px]">{VIEW_TITLE[view]}</h1>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {ideas.length > 0 && <FilterButton />}
          <QuickAdd />
        </span>
      </div>
      <span className="sr-only">Wunschliste · {ideas.length}</span>

      {ideas.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <FilteredEmpty what="Ideen" />
      ) : (
        <ul data-scroll className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 pb-2" aria-label="Eure Wunschliste">
          {visible.map((idea) => (
            <li key={idea.id} className="animate-pop-in">
              <IdeaCard idea={{ ...idea, creator: idea.createdById ? people[idea.createdById] : null, isNext: next?.ideaId === idea.id, tag: tagOf(idea) }} onOpen={() => show(idea)} />
            </li>
          ))}
        </ul>
      )}

      {editSheet}
    </div>
  );
}

const VIEW_TITLE: Record<ListView, string> = {
  all: "alle.",
  match: "matches.",
  swiped: "geswipt.",
  small: "kurz.",
  large: "lang.",
  outdoor: "draußen.",
  indoor: "drinnen.",
  local: "mit ort.",
  own: "eigene.",
};

function inView(idea: BoardIdea, view: ListView): boolean {
  switch (view) {
    case "all":
      return true;
    case "match":
      return idea.matched;
    case "swiped":
      return idea.source === "deck";
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] border-[1.5px] border-dashed border-line px-6 py-10 text-center">
      <Mascot id="no-ideas" size={64} />
      <h2 className="text-[22px] font-bold">Noch keine Ideen</h2>
      <p className="text-muted">
        Tippt auf <strong className="text-ink">+ Idee</strong>, sobald euch etwas einfällt – oder swipt ein paar Vorschläge.
      </p>
    </div>
  );
}
