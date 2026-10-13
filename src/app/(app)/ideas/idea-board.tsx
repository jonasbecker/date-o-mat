"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { IdeaForm, type IdeaFormDefaults } from "@/components/idea-form";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SIZE_LABEL, SizeChip } from "@/components/size-chip";
import { cn } from "@/lib/cn";
import type { IdeaSize, UserColor } from "@/lib/domain";
import { displayHost, formatCost } from "@/lib/idea-input";
import { archiveIdeaAction, updateIdeaAction } from "./actions";

export type BoardPerson = { name: string; color: UserColor | null };
export type BoardIdea = IdeaFormDefaults & { id: string; createdById: string | null; updatedById: string | null };

type Filter = "all" | IdeaSize;

export function IdeaBoard({ ideas, people }: { ideas: BoardIdea[]; people: Record<string, BoardPerson> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<BoardIdea | null>(null);
  const sheet = useRef<SheetHandle>(null);

  const counts = { all: ideas.length, small: 0, large: 0 };
  for (const idea of ideas) counts[idea.size]++;
  const visible = filter === "all" ? ideas : ideas.filter((idea) => idea.size === filter);

  function edit(idea: BoardIdea) {
    setEditing(idea);
    sheet.current?.open();
  }

  const filters: Array<{ value: Filter; label: string }> = [
    { value: "all", label: "Alle" },
    { value: "small", label: `${SIZE_LABEL.small.emoji} Klein · ${counts.small}` },
    { value: "large", label: `${SIZE_LABEL.large.emoji} Groß · ${counts.large}` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[30px] font-bold">Wunschliste</h1>
        <span className="rounded-full border-2 border-line bg-surface px-3 py-0.5 text-[13px] font-extrabold">
          {counts.all} {counts.all === 1 ? "Idee" : "Ideen"}
        </span>
      </div>

      <div role="group" aria-label="Nach Größe filtern" className="flex gap-2">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "h-9 rounded-full border-2 border-line px-3.5 text-sm font-extrabold",
              filter === option.value ? "bg-ink text-bg" : "bg-surface text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {ideas.length === 0 ? (
        <EmptyState />
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
