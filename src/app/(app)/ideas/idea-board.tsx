"use client";

import { useRef, useState } from "react";
import { FilteredEmpty, FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { matchesIdeaFilter } from "@/core/filters";
import { Avatar } from "@/components/avatar";
import { IdeaForm, type IdeaFormDefaults } from "@/components/idea-form";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SizeChip } from "@/components/size-chip";
import type { UserColor } from "@/lib/domain";
import { displayHost, formatCost } from "@/lib/idea-input";
import { archiveIdeaAction, updateIdeaAction } from "./actions";

export type BoardPerson = { name: string; color: UserColor | null };
export type BoardIdea = IdeaFormDefaults & { id: string; createdById: string | null; updatedById: string | null };

export function IdeaBoard({ ideas, people }: { ideas: BoardIdea[]; people: Record<string, BoardPerson> }) {
  const [filter] = useIdeaFilter();
  const [editing, setEditing] = useState<BoardIdea | null>(null);
  const sheet = useRef<SheetHandle>(null);

  const visible = ideas.filter((idea) => matchesIdeaFilter({ size: idea.size, costEur: idea.costEur }, filter));

  function edit(idea: BoardIdea) {
    setEditing(idea);
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

      {ideas.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <FilteredEmpty what="Ideen" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {visible.map((idea) => (
            <li key={idea.id} className="animate-pop-in">
              <IdeaCard idea={idea} creator={idea.createdById ? people[idea.createdById] : undefined} onEdit={() => edit(idea)} />
            </li>
          ))}
        </ul>
      )}

      <Sheet ref={sheet} title="Idee bearbeiten" onClose={() => setEditing(null)}>
        {editing && (
          <IdeaForm
            key={editing.id}
            action={updateIdeaAction}
            idea={editing}
            onSaved={() => sheet.current?.close()}
            onDelete={async () => {
              await archiveIdeaAction(editing.id);
              sheet.current?.close();
            }}
            footnote={footnote(editing, people)}
          />
        )}
      </Sheet>
    </div>
  );
}

function footnote(idea: BoardIdea, people: Record<string, BoardPerson>): string | undefined {
  const creator = idea.createdById ? people[idea.createdById]?.name : undefined;
  const editor = idea.updatedById ? people[idea.updatedById]?.name : undefined;
  if (!creator) return undefined;
  return editor && editor !== creator ? `Eingetragen von ${creator} · zuletzt geändert von ${editor}` : `Eingetragen von ${creator}`;
}

function IdeaCard({ idea, creator, onEdit }: { idea: BoardIdea; creator?: BoardPerson; onEdit: () => void }) {
  const cost = formatCost(idea.costEur);
  return (
    <div className="sticker relative flex flex-col gap-2 rounded-[20px] bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        {/* Stretched button: the whole card opens the editor, the link stays clickable. */}
        <button
          type="button"
          onClick={onEdit}
          className="text-left font-display text-lg font-semibold leading-snug after:absolute after:inset-0 after:rounded-[20px] after:content-['']"
        >
          {idea.title}
        </button>
        {creator && <Avatar person={creator} size={28} className="mt-0.5" />}
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-extrabold text-muted">
        <SizeChip size={idea.size} />
        {cost && <span>{cost}</span>}
        {idea.location && <span>📍 {idea.location}</span>}
        {idea.url && (
          <a
            href={idea.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 underline decoration-2 underline-offset-2"
          >
            🔗 {displayHost(idea.url)}
          </a>
        )}
      </div>
      {idea.note && <p className="line-clamp-2 text-sm font-semibold text-muted">{idea.note}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[24px] border-[2.5px] border-dashed border-line px-6 py-10 text-center">
      <span className="text-5xl" aria-hidden="true">
        💡
      </span>
      <h2 className="text-[22px] font-bold">Noch keine Ideen</h2>
      <p className="font-semibold text-muted">
        Tippt unten auf das gelbe <strong className="text-ink">+</strong>, sobald euch etwas einfällt – Titel und Größe
        reichen.
      </p>
    </div>
  );
}
