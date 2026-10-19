"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FilterButton, FilteredEmpty, useIdeaFilter } from "@/components/idea-filter";
import { categoryOf } from "@/core/categories";
import { matchesIdeaFilter } from "@/core/filters";
import { teaserLabel } from "@/core/start-layout";
import { IdeaCard } from "@/components/idea-card";
import { IdeaForm } from "@/components/idea-form";
import { Mascot } from "@/components/mascot";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { HeartIcon } from "@/components/icons";
import { buttonClass } from "@/components/button";
import { archiveIdeaAction, updateIdeaAction } from "./ideas/actions";
import { footnote, IdeaMenu, type BoardIdea, type BoardNextDate, type BoardPerson } from "./ideas/idea-board";

/**
 * The start page below the status box: the wishlist, longest waiting first. With no date ahead a
 * tap on an idea goes straight to its free times; otherwise it opens the idea's menu (swap the
 * next date, plan another one, edit). Swiping is one button next to the title.
 */
export function StartIdeas({
  ideas,
  people,
  next,
  canPlanNew,
  partnerName,
  swipeCount,
}: {
  ideas: BoardIdea[];
  people: Record<string, BoardPerson>;
  next: BoardNextDate | null;
  canPlanNew: boolean;
  partnerName: string;
  swipeCount: number;
}) {
  const router = useRouter();
  const [filter] = useIdeaFilter();
  const [open, setOpen] = useState<{ idea: BoardIdea; view: "menu" | "edit" } | null>(null);
  const sheet = useRef<SheetHandle>(null);
  const visible = ideas.filter((idea) => matchesIdeaFilter({ size: idea.size, costEur: idea.costEur, setting: idea.setting, category: categoryOf(idea) }, filter));
  const direct = canPlanNew && !next;

  return (
    <section aria-label="Eure Wunschliste" data-start-ideas className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Wunschliste</h2>
        <div className="flex items-center gap-2">
          {ideas.length > 0 && <FilterButton />}
          <Link href="/ideas/entdecken" data-swipe-link className="flat tap flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-extrabold">
            <HeartIcon width={16} height={16} className="text-himbeere" /> Swipen{swipeCount > 0 && <span className="rounded-full bg-himbeere px-1.5 text-[12px] text-tinte">{swipeCount}</span>}
          </Link>
        </div>
      </div>

      {ideas.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-8 text-center">
          <Mascot id="no-ideas" size={56} />
          <p className="font-display text-xl font-semibold">Noch keine Ideen</p>
          <p className="text-sm font-bold text-muted">Swipe, bis etwas drauf ist – oder tipp unten aufs Logo für „Idee“.</p>
          <Link href="/ideas/entdecken" className={buttonClass("primary", "md")}>
            {teaserLabel(swipeCount)}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <FilteredEmpty what="Ideen" />
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-1">
          {visible.map((idea) => {
            const card = { ...idea, creator: idea.createdById ? people[idea.createdById] : null, isNext: next?.ideaId === idea.id };
            return (
              <li key={idea.id} className="shrink-0">
                {direct ? (
                  <IdeaCard idea={card} onOpen={() => router.push(`/plan?idea=${idea.id}`)} />
                ) : (
                  <IdeaCard
                    idea={card}
                    onOpen={() => {
                      setOpen({ idea, view: "menu" });
                      sheet.current?.open();
                    }}
                  />
                )}
              </li>
            );
          })}
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
    </section>
  );
}
