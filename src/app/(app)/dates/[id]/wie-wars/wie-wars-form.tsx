"use client";

// "wie war's?" (ARCHIV.md §3): photos onto the leaf, "nochmal?" as three plant tiles (nö = a wilted leaf, vielleicht =
// a bud, unbedingt = a flower), the flower reacting with its mood and a quip from its mouth, one sentence for later.
// "Blatt anheften" waits for the answer, saves and opens the leaf; the other one's answer shows only after your own.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Bloom } from "@/components/bloom";
import { againReaction, NOTE_MAX } from "@/core/archive";
import { cn } from "@/lib/cn";
import { AGAIN_ANSWERS, AGAIN_LABEL, PHOTO_LIMITS, type AgainAnswer } from "@/lib/domain";
import { saveReviewAction, type ReviewFormState } from "../../actions";
import { usePhotoUpload } from "../../photo-upload";

type Shape = { l: number; t: number; w: number; h: number; bg: string; r: string; rot?: number };
// The three tiles' little plants (ArchivWieWars.html renderVals).
const ICONS: Record<AgainAnswer, Shape[]> = {
  no: [
    { l: 4, t: 8, w: 32, h: 18, bg: "#8A6440", r: "0 90% 0 90%", rot: 35 },
    { l: 14, t: 15, w: 14, h: 2, bg: "#5A4128", r: "1px", rot: 35 },
  ],
  maybe: [
    { l: 18, t: 14, w: 4, h: 20, bg: "#3E8E52", r: "2px" },
    { l: 12, t: 2, w: 16, h: 18, bg: "#F2A7BB", r: "50% 50% 45% 45%" },
    { l: 22, t: 18, w: 12, h: 7, bg: "#4FA25E", r: "0 90% 0 90%", rot: -20 },
  ],
  yes: [
    { l: 7, t: 4, w: 13, h: 13, bg: "#F2A7BB", r: "50%" },
    { l: 20, t: 4, w: 13, h: 13, bg: "#F7C1CF", r: "50%" },
    { l: 7, t: 16, w: 13, h: 13, bg: "#F7C1CF", r: "50%" },
    { l: 20, t: 16, w: 13, h: 13, bg: "#F2A7BB", r: "50%" },
    { l: 14, t: 10, w: 12, h: 12, bg: "#F5D76E", r: "50%" },
  ],
};

export function WieWarsForm({
  dateId,
  head,
  title,
  partnerName,
  photoIds,
  canUpload,
  initial,
  cost,
  partnerWaiting,
}: {
  dateId: string;
  head: string;
  title: string;
  partnerName: string;
  photoIds: string[];
  canUpload: boolean;
  initial: { again: AgainAnswer | null; note: string };
  /** What it cost (the real amount, else the estimate) – for the budget. */
  cost: number | null;
  partnerWaiting: boolean;
}) {
  const router = useRouter();
  const [again, setAgain] = useState<AgainAnswer | null>(initial.again);
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(saveReviewAction, { status: "idle" });
  const { fileInput, pick, progress, message, remaining } = usePhotoUpload(dateId, photoIds.length);
  const flower = againReaction(again);
  // Saved: off to the leaf.
  useEffect(() => {
    if (state.status === "saved") router.push(`/dates/${dateId}`);
  }, [state, router, dateId]);

  return (
    <form action={action} data-wie-wars className="flex min-h-0 flex-1 flex-col gap-3">
      <input type="hidden" name="dateId" value={dateId} />
      <input type="hidden" name="again" value={again ?? ""} />
      <div className="flex items-center justify-between">
        <Link data-back href="/plan" aria-label="Schließen" className="tap flex size-[42px] items-center justify-center rounded-full bg-surface text-lg">
          ✕
        </Link>
        <span className="font-mono text-[11px] uppercase text-muted">{head}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="headline text-[54px] tracking-[-0.05em]">wie war’s?</h1>
        <p className="truncate text-base text-muted">{title}</p>
      </div>

      {/* Photos onto the leaf: the dashed leaf, then the photos in a row with "+" staying. */}
      {photoIds.length === 0 ? (
        <button
          type="button"
          onClick={pick}
          disabled={!canUpload || progress !== null}
          className="flex h-[clamp(120px,22vh,190px)] shrink-0 flex-col items-center justify-center gap-2.5 rounded-[0_90px_0_90px] border-2 border-dashed border-[#3A4A40] bg-[#151F18]"
        >
          <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-surface">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
          <span className="text-[17px] font-bold">{progress ? `Lädt hoch … ${progress.done} von ${progress.total}` : "Fotos aufs Blatt"}</span>
          <span className="font-mono text-[11px] text-muted">
            {canUpload ? `bis zu ${PHOTO_LIMITS.perDate} · ${partnerName} sieht sie auch` : "Fotos sind auf dem Server noch nicht eingerichtet"}
          </span>
        </button>
      ) : (
        <div data-photo-row className="flex h-[clamp(96px,16vh,130px)] shrink-0 items-center gap-2 overflow-x-auto rounded-[0_60px_0_60px] border-2 border-dashed border-[#3A4A40] bg-[#151F18] px-3 [scrollbar-width:none]">
          {photoIds.map((id, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- private photo route
            <img key={id} src={`/api/photos/${id}?size=thumb`} alt={`Foto ${i + 1}`} className="aspect-square h-[calc(100%-20px)] shrink-0 rounded-[20px_6px_20px_6px] object-cover" />
          ))}
          {remaining > 0 && (
            <button type="button" aria-label="Foto hinzufügen" onClick={pick} disabled={progress !== null} className="flex aspect-square h-[calc(100%-20px)] shrink-0 items-center justify-center rounded-[20px_6px_20px_6px] border-2 border-dashed border-[#3A4A40] text-2xl text-muted">
              {progress ? <span className="font-mono text-[11px]">{progress.done}/{progress.total}</span> : "+"}
            </button>
          )}
        </div>
      )}
      {fileInput}
      {message && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
          {message}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span id="again-label" className="px-1 font-mono text-[11px] text-muted">
          NOCHMAL?
        </span>
        <div role="radiogroup" aria-labelledby="again-label" className="grid grid-cols-3 gap-2">
          {AGAIN_ANSWERS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={again === a}
              onClick={() => setAgain(a)}
              className={cn("flex h-[clamp(76px,11.6vh,98px)] flex-col items-center justify-center gap-2.5 rounded-[22px]", again === a ? "bg-cta text-[#111A14]" : "bg-surface")}
            >
              <span aria-hidden="true" className="relative h-[34px] w-10">
                {ICONS[a].map((s, i) => (
                  <span key={i} className="absolute" style={{ left: s.l, top: s.t, width: s.w, height: s.h, background: s.bg, borderRadius: s.r, transform: s.rot ? `rotate(${s.rot}deg)` : undefined }} />
                ))}
              </span>
              <span className="text-[15px] font-bold">{AGAIN_LABEL[a]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* The flower takes the answer; its bubble comes out of its mouth and covers nothing. */}
      <div className="relative flex h-[clamp(84px,15vh,126px)] shrink-0 items-start">
        <div aria-hidden="true" className="relative aspect-[300/420] h-full shrink-0">
          <Bloom stimmung={flower.mood} blaetter={3} welk={flower.welk} className="absolute inset-0 size-full" />
        </div>
        <span aria-hidden="true" className="absolute left-[72px] top-[30px] size-1.5 rounded-full bg-tile-light" />
        <span aria-hidden="true" className="absolute left-[82px] top-5 size-2.5 rounded-full bg-tile-light" />
        <p data-flower-quip aria-live="polite" className="ml-1.5 mt-1 max-w-[262px] -rotate-[1.5deg] rounded-[18px] bg-tile-light px-3.5 pb-2.5 pt-2 font-hand text-[21px] font-semibold leading-[1.02] text-[#1B2620]">
          {flower.quip}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="px-1 font-mono text-[11px] text-muted">
          EIN SATZ FÜR SPÄTER
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX}
          defaultValue={initial.note}
          placeholder="was soll auf dem Blatt stehen?"
          className="h-[58px] resize-none rounded-[18px] bg-surface px-3.5 py-2.5 font-hand text-[21px] font-semibold leading-[1.05] text-butter placeholder:text-muted-2 focus:outline-none focus:ring-2 focus:ring-cta"
        />
        <label className="flex items-center gap-2 px-1 font-mono text-[11px] text-muted">
          KOSTEN (€)
          <input type="hidden" name="costBefore" value={cost ?? ""} />
          <input
            name="cost"
            inputMode="numeric"
            defaultValue={cost ?? ""}
            aria-label="Kosten in Euro"
            placeholder="–"
            className="h-8 w-20 rounded-lg bg-surface px-2 font-sans text-sm text-ink focus:outline-none focus:ring-2 focus:ring-cta"
          />
        </label>
        {partnerWaiting && <p className="px-1 font-mono text-[10px] text-muted-2">{partnerName} hat schon geantwortet – du siehst es nach dir.</p>}
      </div>

      {state.status === "error" && (
        <p role="alert" className="font-bold">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={!again || pending}
        className={cn("press mt-auto h-14 shrink-0 rounded-full text-[17px] font-bold", again ? "bg-cta text-[#111A14]" : "bg-divider text-muted-2")}
      >
        {pending ? "Heftet an …" : "Blatt anheften"}
      </button>
    </form>
  );
}
