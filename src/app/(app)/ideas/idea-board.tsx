"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FilteredEmpty, FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { categoryCounts, categoryOf } from "@/core/categories";
import { matchesIdeaFilter } from "@/core/filters";
import { CategoryChips, type ListView } from "@/components/category-chips";
import { Button, buttonClass } from "@/components/button";
import { SwapConfirm, type NextDateInfo } from "@/components/swap-confirm";
import { IdeaForm, type IdeaFormDefaults } from "@/components/idea-form";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { IdeaCard } from "@/components/idea-card";
import { CalendarIcon, PencilIcon, SwapIcon } from "@/components/icons";
import { Mascot } from "@/components/mascot";
import type { UserColor } from "@/lib/domain";
import { archiveIdeaAction, updateIdeaAction } from "./actions";

export type BoardPerson = { name: string; color: UserColor | null };
export type BoardIdea = IdeaFormDefaults & { id: string; createdById: string | null; updatedById: string | null; matched: boolean; source: string };
/** The next date – an idea can take its place. */
export type BoardNextDate = NextDateInfo & { ideaId: string | null; swappable: boolean };

export function IdeaBoard({
  ideas,
  people,
  next,
  canPlanNew,
  partnerName,
  meId,
  initialView = "all",
}: {
  ideas: BoardIdea[];
  people: Record<string, BoardPerson>;
  partnerName: string;
  next: BoardNextDate | null;
  /** The round has no date yet – "Date damit planen" works. */
  canPlanNew: boolean;
  meId: string;
  initialView?: ListView;
}) {
  const [filter] = useIdeaFilter();
  const [open, setOpen] = useState<{ idea: BoardIdea; view: "menu" | "edit" } | null>(null);
  const sheet = useRef<SheetHandle>(null);

  const [view, setView] = useState<ListView>(initialView);
  // Ideas that came from swiping say who liked them.
  const tagOf = (idea: BoardIdea): string | null =>
    idea.source !== "deck" ? null : idea.createdById === meId ? "💚 von dir geswipt" : `💚 ${people[idea.createdById ?? ""]?.name ?? "Ihr"} hat's geliked`;
  const swiped = ideas.filter((idea) => idea.source === "deck");
  const matches = ideas.filter((idea) => idea.matched);
  const visible = ideas
    .filter((idea) => matchesIdeaFilter({ size: idea.size, costEur: idea.costEur, setting: idea.setting, category: categoryOf(idea) }, filter))
    .filter((idea) => (view === "match" ? idea.matched : view === "swiped" ? idea.source === "deck" : true));

  function show(idea: BoardIdea) {
    setOpen({ idea, view: "menu" });
    sheet.current?.open();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[30px] font-bold">
          Wunschliste <span className="font-sans text-base font-extrabold text-muted">· {ideas.length}</span>
        </h1>
        {ideas.length > 0 && <FilterButton />}
      </div>

      {ideas.length > 0 && <CategoryChips counts={categoryCounts(ideas)} view={view} onView={setView} matches={matches.length} swiped={swiped.length} />}

      {ideas.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <FilteredEmpty what="Ideen" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {visible.map((idea) => (
            <li key={idea.id} className="animate-pop-in">
              <IdeaCard idea={{ ...idea, creator: idea.createdById ? people[idea.createdById] : null, isNext: next?.ideaId === idea.id, tag: tagOf(idea) }} onOpen={() => show(idea)} />
            </li>
          ))}
        </ul>
      )}

      <Sheet ref={sheet} title={open?.view === "edit" ? "Idee bearbeiten" : (open?.idea.title ?? "Idee")} onClose={() => setOpen(null)}>
        {open?.view === "menu" && (
          <IdeaMenu key={open.idea.id} idea={open.idea} next={next} canPlanNew={canPlanNew} partnerName={partnerName} onEdit={() => setOpen({ idea: open.idea, view: "edit" })} onDone={() => sheet.current?.close()} />
        )}
        {open?.view === "edit" && (
          <IdeaForm
            key={open.idea.id}
            action={updateIdeaAction}
            idea={open.idea}
            onSaved={() => sheet.current?.close()}
            onDelete={async () => {
              await archiveIdeaAction(open.idea.id);
              sheet.current?.close();
            }}
            footnote={footnote(open.idea, people)}
          />
        )}
      </Sheet>
    </div>
  );
}

/** What tapping an idea offers: plan it (or do it instead of the next date) – or edit it. */
function IdeaMenu({
  idea,
  next,
  canPlanNew,
  partnerName,
  onEdit,
  onDone,
}: {
  idea: BoardIdea;
  next: BoardNextDate | null;
  canPlanNew: boolean;
  partnerName: string;
  onEdit: () => void;
  onDone: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const isNext = next?.ideaId === idea.id;
  const swap = next?.swappable && !isNext;

  if (confirming && next) {
    return (
      <SwapConfirm
        next={next}
        idea={idea}
        onCancel={() => setConfirming(false)}
        onDone={() => {
          onDone();
          router.push("/plan");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {isNext && <p className="rounded-[18px] border-2 border-line bg-minze-soft px-4 py-2.5 font-bold text-tinte">📅 Das ist euer nächstes Date: {next!.when}</p>}
      {next && !next.swappable && <p className="text-sm font-bold text-muted">Euer nächstes Date ist eine Überraschung von {partnerName} – das kann nur {partnerName} ändern.</p>}
      {swap && (
        <Button onClick={() => setConfirming(true)} className="w-full">
          <SwapIcon width={20} height={20} /> Statt „{next!.title}“ machen
        </Button>
      )}
      {canPlanNew && !isNext && (
        <Link href={`/plan?idea=${idea.id}`} onClick={onDone} className={buttonClass(swap ? "secondary" : "primary", "md", "w-full")}>
          <CalendarIcon width={20} height={20} /> {swap ? "Neues Date damit planen" : "Date damit planen"}
        </Link>
      )}
      <Button variant="secondary" onClick={onEdit} className="w-full">
        <PencilIcon width={18} height={18} /> Bearbeiten
      </Button>
    </div>
  );
}

function footnote(idea: BoardIdea, people: Record<string, BoardPerson>): string | undefined {
  const creator = idea.createdById ? people[idea.createdById]?.name : undefined;
  const editor = idea.updatedById ? people[idea.updatedById]?.name : undefined;
  if (!creator) return undefined;
  return editor && editor !== creator ? `Eingetragen von ${creator} · zuletzt geändert von ${editor}` : `Eingetragen von ${creator}`;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-10 text-center">
      <Mascot id="no-ideas" size={64} />
      <h2 className="text-[22px] font-bold">Noch keine Ideen</h2>
      <p className="font-semibold text-muted">
        Tippt oben auf <strong className="text-ink">+ Idee</strong>, sobald euch etwas einfällt – Titel und Größe
        reichen.
      </p>
    </div>
  );
}
