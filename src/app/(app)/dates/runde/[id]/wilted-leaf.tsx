"use client";

// The wilted leaf (ARCHIV.md §4): "fiel aus." in a softer color, the sad flower saying it from its mouth, who planned
// it, when it was meant to be and why (chips + a note), and what now: a new date, back on the shelf, or off the stem.
import Link from "next/link";
import { useState, useTransition } from "react";
import { Bloom } from "@/components/bloom";
import { NOTE_MAX } from "@/core/archive";
import { cn } from "@/lib/cn";
import { WILT_LABEL, WILT_REASONS, type WiltReason } from "@/lib/domain";
import { PersonDot, type ArchivePerson } from "../../archive-parts";
import { removeLeafAction, setWiltAction, wiltIdeaAction } from "../../actions";

export function WiltedLeaf({
  cycleId,
  head,
  title,
  planner,
  meant,
  reason: savedReason,
  note: savedNote,
  hasIdea,
}: {
  cycleId: string;
  head: string;
  title: string | null;
  planner?: ArchivePerson;
  meant: string | null;
  reason: WiltReason | null;
  note: string | null;
  /** A date was called off (not a round that never had one): its idea can go back. */
  hasIdea: boolean;
}) {
  const [reason, setReason] = useState(savedReason);
  const [note, setNote] = useState(savedNote ?? "");
  const [writing, setWriting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const save = (r: WiltReason | null, n: string) => start(() => setWiltAction(cycleId, r, n || null));

  return (
    <div data-wilt={cycleId} className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between">
        <Link data-back href="/dates" aria-label="Zurück zum Archiv" className="tap flex size-[42px] items-center justify-center rounded-full bg-surface text-lg">
          ←
        </Link>
        <span className="font-mono text-[11px] uppercase text-muted">{head}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="headline text-[54px] tracking-[-0.05em] text-text-soft">fiel aus.</h1>
        {title && <p className="truncate text-base text-muted">{title}</p>}
      </div>

      <div className="relative flex h-[clamp(130px,25vh,210px)] shrink-0 items-start gap-8">
        <div aria-hidden="true" className="relative aspect-[300/420] h-full shrink-0">
          <Bloom stimmung="traurig" blaetter={3} welk={1} className="absolute inset-0 size-full" />
          {/* Two dots from its mouth to the bubble. */}
          <span className="absolute left-[96%] top-[30%] size-1.5 rounded-full bg-tile-light" />
          <span className="absolute left-[106%] top-[23%] size-2.5 rounded-full bg-tile-light" />
        </div>
        <p className="mt-[8%] max-w-[194px] -rotate-2 rounded-[18px] bg-tile-light px-3.5 pb-2.5 pt-2 text-center font-hand text-[21px] font-semibold leading-[1.02] text-[#1B2620]">
          passiert. gießen wir’s nochmal?
        </p>
      </div>

      <div className="flex flex-col rounded-[22px] bg-surface px-4 py-1.5">
        <div className="grid min-h-12 grid-cols-[100px_minmax(0,1fr)] items-center border-b border-divider">
          <span className="font-mono text-[11px] text-muted">GEPLANT VON</span>
          <span className="flex items-center gap-2 text-[15px] font-semibold">
            <PersonDot person={planner} size={22} label={planner?.name} />
            {planner?.name ?? "–"}
          </span>
        </div>
        <div className="grid min-h-12 grid-cols-[100px_minmax(0,1fr)] items-center border-b border-divider">
          <span className="font-mono text-[11px] text-muted">WAR GEDACHT</span>
          <span className="text-[15px] font-semibold">{meant ?? "kein Date in der Runde"}</span>
        </div>
        <div className="grid min-h-12 grid-cols-[100px_minmax(0,1fr)] items-center gap-y-2 py-2">
          <span className="font-mono text-[11px] text-muted">WARUM</span>
          <span role="radiogroup" aria-label="Warum fiel es aus?" className="flex flex-wrap gap-1.5">
            {WILT_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                disabled={busy}
                onClick={() => {
                  const next = reason === r ? null : r;
                  setReason(next);
                  save(next, note);
                }}
                className={cn("inline-flex h-7 items-center rounded-full px-3 text-[13px] font-semibold", reason === r ? "bg-cta text-[#111A14]" : "bg-divider")}
              >
                {WILT_LABEL[r]}
              </button>
            ))}
            {!writing && !note && (
              <button type="button" onClick={() => setWriting(true)} className="inline-flex h-7 items-center rounded-full border-[1.5px] border-dashed border-[#3A4A40] px-3 text-[13px] text-muted">
                + notiz
              </button>
            )}
          </span>
          {(writing || note) && (
            <input
              aria-label="Notiz"
              value={note}
              maxLength={NOTE_MAX}
              autoFocus={writing}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => save(reason, note)}
              placeholder="was war los?"
              className="col-span-2 h-10 rounded-xl bg-divider px-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-cta"
            />
          )}
        </div>
      </div>

      <p className="flex items-start gap-2.5 px-1 text-sm leading-[1.35] text-muted">
        <span aria-hidden="true" className="mt-0.5 h-[18px] w-[30px] shrink-0 -rotate-[20deg] rounded-[0_90%_0_90%] border-2 border-dashed border-[#6DBA74]" />
        Welke Blätter bleiben am Stiel – gehört dazu. Die Idee könnt ihr neu planen oder zurück ins Regal legen.
      </p>

      <div className="mt-auto flex shrink-0 flex-col gap-2">
        <button type="button" disabled={busy} onClick={() => start(() => wiltIdeaAction(cycleId, "plan"))} className="press h-14 rounded-full bg-cta text-[17px] font-bold text-[#111A14]">
          Neuen Termin finden
        </button>
        {hasIdea && (
          <button type="button" disabled={busy} onClick={() => start(() => wiltIdeaAction(cycleId, "shelf"))} className="press h-[50px] rounded-full border-2 border-[#3A4A40] text-[15px] font-bold">
            Zurück ins Regal legen
          </button>
        )}
        {confirm ? (
          <span role="alertdialog" aria-label="Blatt entfernen?" className="flex items-center justify-center gap-3 py-1.5 text-[13px]">
            Blatt wirklich vom Stiel nehmen?
            <button type="button" disabled={busy} onClick={() => start(() => removeLeafAction(cycleId))} className="font-bold underline">
              Ja, entfernen
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="underline">
              Nein
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="self-center p-1.5 text-[13px] text-muted-2">
            Blatt entfernen
          </button>
        )}
      </div>
    </div>
  );
}
