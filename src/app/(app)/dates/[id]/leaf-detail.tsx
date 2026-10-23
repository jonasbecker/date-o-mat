"use client";

// A leaf (ARCHIV.md §2, ArchivBlatt.html variante "a"): the photo big at the top – swipe between them, dots, "1 / 4" –,
// who planned it and the title over its fade, the small photos with a "+", both "nochmal?" and both notes, and at the
// bottom "Nochmal pflanzen" and "Teilen". Without a photo the idea's banner fills the top. No tab bar.
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Banner } from "@/components/banner";
import type { SceneView } from "@/core/banner-scene";
import { cn } from "@/lib/cn";
import { AGAIN_LABEL, type AgainAnswer } from "@/lib/domain";
import { PersonDot, type ArchivePerson } from "../archive-parts";
import { deletePhotoAction, replantAction } from "../actions";
import { usePhotoUpload } from "../photo-upload";

export type LeafAnswer = { person: ArchivePerson; again: AgainAnswer | null; note: string | null; hidden: boolean };

export function LeafDetail({
  dateId,
  nr,
  title,
  meta,
  planner,
  scene,
  photoIds,
  answers,
  myAnswerMissing,
  canUpload,
}: {
  dateId: string;
  nr: number;
  title: string;
  meta: string;
  planner?: ArchivePerson;
  scene: SceneView;
  photoIds: string[];
  /** Me first, then the partner (their answer hidden until mine is there). */
  answers: LeafAnswer[];
  myAnswerMissing: boolean;
  canUpload: boolean;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const [shared, setShared] = useState<string | null>(null);
  const { fileInput, pick, progress, message, remaining } = usePhotoUpload(dateId, photoIds.length);
  const index = Math.min(active, Math.max(0, photoIds.length - 1));

  function go(i: number) {
    const el = strip.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActive(i);
  }
  async function share() {
    const text = `${title} – ${meta.toLocaleLowerCase("de-DE")}`;
    try {
      if (navigator.share) {
        // The photo itself where the phone can share files; else just the words.
        const photo = photoIds[index];
        const file = photo ? await fetch(`/api/photos/${photo}`).then((r) => r.blob()).then((b) => new File([b], "blatt.jpg", { type: b.type || "image/jpeg" })) : null;
        await navigator.share(file && navigator.canShare?.({ files: [file] }) ? { title, text, files: [file] } : { title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared("Kopiert.");
    } catch {
      // closed the share sheet – nothing to say
    }
  }

  return (
    <div data-leaf-detail={dateId} className="relative -mx-5 -mt-[max(env(safe-area-inset-top),16px)] flex min-h-0 flex-1 flex-col">
      {/* The photo, full width, fading into the page. */}
      <div className="relative h-[min(440px,52vh)] shrink-0">
        {photoIds.length ? (
          <div
            ref={strip}
            data-photo-strip
            onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
            className="flex size-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          >
            {photoIds.map((id, i) => (
              // The small one (already there for the row below) shows at once; the big one is asked for only for the
              // photo in view and its neighbours, and covers it once it has arrived.
              <div key={id} className="relative size-full shrink-0 snap-center bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element -- private photo route */}
                <img src={`/api/photos/${id}?size=thumb`} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
                {Math.abs(i - index) <= 1 && (
                  // eslint-disable-next-line @next/next/no-img-element -- private photo route
                  <img src={`/api/photos/${id}`} alt={`Foto ${i + 1} von ${photoIds.length}`} decoding="async" className="absolute inset-0 size-full object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <Banner scene={scene} className="absolute inset-0" />
        )}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] bg-[linear-gradient(180deg,rgba(17,26,20,0)_0%,var(--bg)_92%)]" />
        {photoIds.length > 1 && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[134px] flex justify-center gap-1.5">
            {photoIds.map((id, i) => (
              <span key={id} className={cn("h-1.5 rounded-[3px] bg-ink", i === index ? "w-[18px]" : "w-1.5 opacity-50")} />
            ))}
          </span>
        )}
        <div className="absolute inset-x-4 top-[max(env(safe-area-inset-top),16px)] flex items-center justify-between">
          <Link data-back href="/dates" aria-label="Zurück zum Archiv" className="tap flex size-[42px] items-center justify-center rounded-full bg-[rgba(17,26,20,0.72)] text-lg">
            ←
          </Link>
          {photoIds.length > 0 && (
            <span data-photo-count className="rounded-full bg-[rgba(17,26,20,0.72)] px-3 py-1.5 font-mono text-[11px]">
              {index + 1} / {photoIds.length}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-[1] -mt-[88px] flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-[96px]">
        <div className="flex flex-col gap-2 px-1">
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase text-text-soft">
            <PersonDot person={planner} size={22} />
            {planner ? `${planner.name} hat geplant · ` : ""}Nº{nr}
          </span>
          <h1 className="text-[30px] font-extrabold leading-[1.02] tracking-[-0.035em]">{title}</h1>
          <span className="font-mono text-[11px] uppercase text-muted">{meta}</span>
        </div>

        {/* The small photos: tap = that one big; "+" adds more (up to 10). */}
        <div className="-mx-4 flex shrink-0 gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {photoIds.map((id, i) => (
            <button
              key={id}
              type="button"
              aria-label={`Foto ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => go(i)}
              className={cn("relative size-[60px] shrink-0 overflow-hidden rounded-[20px_6px_20px_6px]", i === index && "shadow-[0_0_0_3px_var(--color-ink)]")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private photo route */}
              <img src={`/api/photos/${id}?size=thumb`} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
          {canUpload && remaining > 0 && (
            <button
              type="button"
              aria-label="Foto hinzufügen"
              onClick={pick}
              disabled={progress !== null}
              className="flex size-[60px] shrink-0 items-center justify-center rounded-[20px_6px_20px_6px] border-2 border-dashed border-[#3A4A40] text-2xl text-muted"
            >
              {progress ? <span className="font-mono text-[11px]">{progress.done}/{progress.total}</span> : "+"}
            </button>
          )}
          {fileInput}
        </div>
        {message && (
          <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
            {message}
          </p>
        )}

        <div data-again className="flex min-h-14 flex-wrap items-center justify-between gap-2 rounded-[20px] bg-surface py-2 pl-4 pr-2">
          <span className="font-mono text-[11px] text-muted">NOCHMAL?</span>
          <span className="flex flex-wrap justify-end gap-1.5">
            {answers.map((a) => (
              <span key={a.person.id} className="flex h-9 items-center gap-2 rounded-full bg-divider pl-1 pr-3 text-[13px] font-bold">
                <PersonDot person={a.person} size={28} label={a.person.name} />
                {a.hidden ? "🔒 nach dir" : a.again ? AGAIN_LABEL[a.again] : "noch offen"}
              </span>
            ))}
          </span>
        </div>
        {myAnswerMissing && (
          <Link href={`/dates/${dateId}/wie-wars`} className="tap -mt-2 self-end text-sm font-bold underline">
            wie war’s? – jetzt antworten ›
          </Link>
        )}

        {answers.some((a) => a.note && !a.hidden) && (
          <div data-notes className="flex flex-col gap-2.5 rounded-[20px] bg-surface px-3.5 py-3">
            {answers
              .filter((a) => a.note && !a.hidden)
              .map((a) => (
                <p key={a.person.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5">
                    <PersonDot person={a.person} size={22} label={a.person.name} />
                  </span>
                  <span className="font-hand text-xl font-semibold leading-[1.05] text-butter">{a.note}</span>
                </p>
              ))}
          </div>
        )}

        {photoIds.length > 0 &&
          (confirm ? (
            <span className="flex items-center gap-3 self-start text-sm">
              Foto {index + 1} wirklich entfernen?
              <button
                type="button"
                disabled={busy}
                onClick={() => start(async () => (setConfirm(false), await deletePhotoAction(photoIds[index])))}
                className="font-bold underline"
              >
                Ja
              </button>
              <button type="button" onClick={() => setConfirm(false)} className="underline">
                Nein
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="self-start text-[13px] text-muted-2 underline">
              Dieses Foto entfernen
            </button>
          ))}
      </div>

      {/* The two actions stay at the bottom while the rest scrolls. */}
      <div className="absolute inset-x-0 bottom-0 z-[2] flex gap-2.5 bg-[linear-gradient(180deg,rgba(17,26,20,0)_0%,var(--bg)_30%)] px-4 pb-[max(env(safe-area-inset-bottom),22px)] pt-5">
        <button
          type="button"
          disabled={busy}
          onClick={() => start(() => replantAction(dateId))}
          className="press flex h-[54px] flex-1 items-center justify-center rounded-full bg-cta text-[17px] font-bold text-[#111A14]"
        >
          Nochmal pflanzen
        </button>
        <button type="button" onClick={share} className="press flex h-[54px] items-center justify-center rounded-full border-2 border-[#3A4A40] px-[18px] text-[15px] font-bold">
          {shared ?? "Teilen"}
        </button>
      </div>
    </div>
  );
}
