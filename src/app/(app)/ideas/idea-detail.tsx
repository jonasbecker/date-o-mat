"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonClass } from "@/components/button";
import { BackIcon, CalendarIcon, PencilIcon, SwapIcon } from "@/components/icons";
import { SizeChip } from "@/components/size-chip";
import { SwapConfirm } from "@/components/swap-confirm";
import { CATEGORY_LABEL, categoryOf } from "@/core/categories";
import type { BoardIdea, BoardNextDate } from "./idea-board";

const SETTING = { indoor: "🏠 Drinnen", outdoor: "🌳 Draußen" } as const;

/**
 * One idea on the whole screen: everything about it, and at the bottom what you do with it –
 * plan it (or do it instead of the next date), edit it, delete it.
 */
export function IdeaDetail({
  idea,
  backHref,
  next,
  canPlanNew,
  partnerName,
  tag,
  footnote,
  onEdit,
  onDelete,
}: {
  idea: BoardIdea;
  backHref: string;
  next: BoardNextDate | null;
  canPlanNew: boolean;
  partnerName: string;
  tag: string | null;
  footnote?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<"swap" | "delete" | null>(null);
  const isNext = next?.ideaId === idea.id;
  const swap = next?.swappable && !isNext;
  const category = CATEGORY_LABEL[categoryOf(idea)];

  return (
    <div className="animate-slide-in flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link data-back href={backHref} aria-label="Zurück zur Liste" className="tap flex size-11 items-center justify-center rounded-full bg-surface">
          <BackIcon width={20} height={20} />
        </Link>
        {idea.matched && <span className="rounded-full bg-rose px-3 py-1 text-sm font-semibold text-tinte">♥ Match</span>}
      </div>

      <div data-scroll className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
        <h1 className="font-display text-[34px] font-extrabold leading-[1.02] tracking-[-0.03em] text-balance break-words">{idea.title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <SizeChip size={idea.size} />
          <span className="rounded-full bg-surface px-3 py-1">
            {category.emoji} {category.label}
          </span>
          {idea.setting && <span className="rounded-full bg-surface px-3 py-1">{SETTING[idea.setting]}</span>}
          {idea.costEur != null && <span className="rounded-full bg-surface px-3 py-1">{idea.costEur === 0 ? "🆓 Gratis" : `ca. ${idea.costEur} €`}</span>}
        </div>
        {isNext && <p className="rounded-[18px] bg-minze-soft px-4 py-2.5 font-semibold text-tinte">📅 Das ist euer nächstes Date: {next!.when}</p>}
        {(idea.location || idea.note || idea.url) && (
          <div className="flex flex-col gap-2.5 rounded-[22px] bg-surface p-4">
            {idea.location && <p className="font-semibold">📍 {idea.location}</p>}
            {idea.note && <p className="select-text whitespace-pre-line text-[15px]">{idea.note}</p>}
            {idea.url && (
              <a href={idea.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold underline">
                🔗 {idea.url.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            )}
          </div>
        )}
        {tag && <p className="text-sm text-muted">{tag}</p>}
        {footnote && <p className="text-sm text-muted">{footnote}</p>}
        {next && !next.swappable && <p className="text-sm text-muted">Euer nächstes Date ist eine Überraschung von {partnerName} – das kann nur {partnerName} ändern.</p>}
      </div>

      {confirming === "swap" && next ? (
        <SwapConfirm next={next} idea={idea} onCancel={() => setConfirming(null)} onDone={() => router.push("/plan")} />
      ) : confirming === "delete" ? (
        <div className="flex items-center justify-between gap-3 rounded-[22px] bg-himbeere-soft px-4 py-3 text-tinte">
          <span className="font-semibold">Wirklich löschen?</span>
          <span className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
              Nein
            </Button>
            <Button size="sm" onClick={onDelete}>
              Ja, löschen
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-2">
          {swap && (
            <Button onClick={() => setConfirming("swap")} size="lg" className="w-full">
              <SwapIcon width={20} height={20} /> Statt „{next!.title}“ machen
            </Button>
          )}
          {canPlanNew && !isNext && (
            <Link href={`/plan?idea=${idea.id}`} className={buttonClass(swap ? "secondary" : "primary", "lg", "w-full")}>
              <CalendarIcon width={20} height={20} /> {swap ? "Neues Date damit planen" : "Date damit planen"}
            </Link>
          )}
          <div className="flex items-center justify-center gap-6 pt-1 text-sm font-semibold">
            <button type="button" onClick={onEdit} className="flex items-center gap-1.5 underline">
              <PencilIcon width={16} height={16} /> Bearbeiten
            </button>
            <button type="button" onClick={() => setConfirming("delete")} className="text-muted underline">
              Löschen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
