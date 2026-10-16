"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { FilteredEmpty, FilterButton, useIdeaFilter } from "@/components/idea-filter";
import { matchesIdeaFilter } from "@/core/filters";
import { Avatar } from "@/components/avatar";
import { Button, buttonClass } from "@/components/button";
import { IdeaForm, type IdeaFormDefaults } from "@/components/idea-form";
import { Sheet, type SheetHandle } from "@/components/sheet";
import { SizeChip } from "@/components/size-chip";
import type { IdeaSize, UserColor } from "@/lib/domain";
import { displayHost, formatCost } from "@/lib/idea-input";
import { archiveIdeaAction, swapDateIdeaAction, updateIdeaAction } from "./actions";

export type BoardPerson = { name: string; color: UserColor | null };
export type BoardIdea = IdeaFormDefaults & { id: string; createdById: string | null; updatedById: string | null; matched: boolean };
/** The next date – an idea can take its place. */
export type BoardNextDate = { id: string; title: string; when: string; size: IdeaSize; ideaId: string | null; swappable: boolean };

export function IdeaBoard({
  ideas,
  people,
  next,
  canPlanNew,
  partnerName,
}: {
  ideas: BoardIdea[];
  people: Record<string, BoardPerson>;
  partnerName: string;
  next: BoardNextDate | null;
  /** The round has no date yet – "Date damit planen" works. */
  canPlanNew: boolean;
}) {
  const [filter] = useIdeaFilter();
  const [open, setOpen] = useState<{ idea: BoardIdea; view: "menu" | "edit" } | null>(null);
  const sheet = useRef<SheetHandle>(null);

  const visible = ideas.filter((idea) => matchesIdeaFilter({ size: idea.size, costEur: idea.costEur }, filter));

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

      {ideas.length === 0 ? (
        <EmptyState />
      ) : visible.length === 0 ? (
        <FilteredEmpty what="Ideen" />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {visible.map((idea) => (
            <li key={idea.id} className="animate-pop-in">
              <IdeaCard idea={idea} creator={idea.createdById ? people[idea.createdById] : undefined} isNext={next?.ideaId === idea.id} onOpen={() => show(idea)} />
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
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isNext = next?.ideaId === idea.id;
  const swap = next?.swappable && !isNext;

  if (confirming && next) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-[20px] border-2 border-line bg-zitrone-soft px-4 py-3 text-tinte">
          <p className="text-[13px] font-extrabold uppercase tracking-wide">Euer nächstes Date</p>
          <p className="font-display text-lg font-semibold leading-snug">{next.title}</p>
          <p className="text-sm font-bold">{next.when}</p>
        </div>
        <p className="font-bold">
          Willst du das ändern? Dann macht ihr stattdessen „{idea.title}“ – der Termin bleibt.
          {idea.size === "large" && next.size === "small" && <span className="mt-1 block text-sm text-muted">Das ist eher was Langes – euer Termin ist kürzer.</span>}
        </p>
        {message && (
          <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
            {message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
            Nein
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await swapDateIdeaAction(next.id, idea.id).catch(() => ({ ok: false, message: "Das hat nicht geklappt – bist du offline?" }));
                if (!result.ok) return setMessage(result.message ?? "Das hat nicht geklappt.");
                onDone();
                router.push("/dates");
              })
            }
          >
            {pending ? "Wird geändert …" : "Ja, ändern"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {isNext && <p className="rounded-[18px] border-2 border-line bg-minze-soft px-4 py-2.5 font-bold text-tinte">📅 Das ist euer nächstes Date: {next!.when}</p>}
      {next && !next.swappable && <p className="text-sm font-bold text-muted">Euer nächstes Date ist eine Überraschung von {partnerName} – das kann nur {partnerName} ändern.</p>}
      {swap && (
        <Button onClick={() => setConfirming(true)} className="w-full">
          🔄 Statt „{next!.title}“ machen
        </Button>
      )}
      {canPlanNew && !isNext && (
        <Link href={`/plan?idea=${idea.id}`} onClick={onDone} className={buttonClass(swap ? "secondary" : "primary", "md", "w-full")}>
          📅 {swap ? "Neues Date damit planen" : "Date damit planen"}
        </Link>
      )}
      <Button variant="secondary" onClick={onEdit} className="w-full">
        ✏️ Bearbeiten
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

function IdeaCard({ idea, creator, isNext, onOpen }: { idea: BoardIdea; creator?: BoardPerson; isNext: boolean; onOpen: () => void }) {
  const cost = formatCost(idea.costEur);
  return (
    <div className="sticker relative flex flex-col gap-2 rounded-[20px] bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        {/* Stretched button: the whole card opens the menu, the link stays clickable. */}
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-display text-lg font-semibold leading-snug after:absolute after:inset-0 after:rounded-[20px] after:content-['']"
        >
          {idea.title}
        </button>
        {creator && <Avatar person={creator} size={28} className="mt-0.5" />}
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-extrabold text-muted">
        <SizeChip size={idea.size} />
        {idea.matched && <span>💞 Match</span>}
        {isNext && <span>📅 Nächstes Date</span>}
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
        Tippt oben auf <strong className="text-ink">+ Idee</strong>, sobald euch etwas einfällt – Titel und Größe
        reichen.
      </p>
    </div>
  );
}
