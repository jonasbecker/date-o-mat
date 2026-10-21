"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Button } from "@/components/button";
import { PHOTO_LIMITS } from "@/lib/domain";
import { resizePhoto } from "@/lib/resize-image";
import { deletePhotoAction, uploadPhotoAction } from "./actions";

export type PhotoView = { id: string; width: number; height: number };

export function PhotoSection({ dateId, photos: allPhotos, enabled }: { dateId: string; photos: PhotoView[]; enabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  // A deleted photo is gone at once, not when the server is done.
  const [photos, hidePhoto] = useOptimistic(allPhotos, (current, id: string) => current.filter((p) => p.id !== id));
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const remaining = PHOTO_LIMITS.perDate - photos.length;

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, remaining);
    setMessage(files.length > remaining ? `Es passen nur noch ${remaining} Fotos dazu.` : null);
    setProgress({ done: 0, total: list.length });
    for (const [index, file] of list.entries()) {
      try {
        const resized = await resizePhoto(file, PHOTO_LIMITS.fullEdge, PHOTO_LIMITS.thumbEdge);
        const form = new FormData();
        form.set("dateId", dateId);
        form.set("full", resized.full, "photo.jpg");
        form.set("thumb", resized.thumb, "thumb.jpg");
        form.set("width", String(resized.width));
        form.set("height", String(resized.height));
        const result = await uploadPhotoAction(form);
        if (!result.ok) setMessage(result.message ?? "Hochladen hat nicht geklappt.");
      } catch {
        setMessage(`„${file.name}“ konnte nicht gelesen werden.`);
      }
      setProgress({ done: index + 1, total: list.length });
    }
    setProgress(null);
    if (input.current) input.current.value = "";
  }

  function show(index: number) {
    setOpen(index);
    setConfirmDelete(false);
    dialog.current?.showModal();
  }

  const current = open !== null ? photos[open] : undefined;

  return (
    <section aria-labelledby="photos-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="photos-heading" className="text-[23px] font-bold">
          Fotos
        </h2>
        {photos.length > 0 && <span className="text-[13px] font-extrabold text-muted">{photos.length}</span>}
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button type="button" onClick={() => show(index)} className="press block aspect-square w-full overflow-hidden rounded-2xl bg-track">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, already resized; next/image would need a public URL */}
                <img src={`/api/photos/${photo.id}?size=thumb`} alt={`Foto ${index + 1}`} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!enabled ? (
        <p className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">Fotos sind auf dem Server noch nicht eingerichtet (siehe docs/SETUP.md).</p>
      ) : remaining > 0 ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            id="photo-input"
            onChange={(event) => event.target.files?.length && upload(event.target.files)}
          />
          <Button variant="secondary" className="w-full" disabled={progress !== null} onClick={() => input.current?.click()}>
            {progress ? `Lädt hoch … ${progress.done} von ${progress.total}` : photos.length ? "📷 Weitere Fotos" : "📷 Fotos hinzufügen"}
          </Button>
          {photos.length === 0 && <p className="text-center text-[13px] font-bold text-muted">Nur ihr zwei seht sie. Sie werden vorher verkleinert.</p>}
        </>
      ) : (
        <p className="text-sm font-bold text-muted">Das Album ist voll ({PHOTO_LIMITS.perDate} Fotos).</p>
      )}
      {message && (
        <p role="alert" className="rounded-xl bg-zitrone-soft px-3 py-2 text-sm font-bold text-tinte">
          {message}
        </p>
      )}

      <dialog
        ref={dialog}
        aria-label="Foto"
        onClose={() => setOpen(null)}
        onClick={(event) => event.target === dialog.current && dialog.current.close()}
        className="m-auto max-h-dvh max-w-[100vw] bg-transparent p-3 backdrop:bg-tinte/85"
      >
        {current && open !== null && (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- private photo route */}
            <img
              src={`/api/photos/${current.id}`}
              alt={`Foto ${open + 1} von ${photos.length}`}
              width={current.width}
              height={current.height}
              className="max-h-[78dvh] w-auto max-w-full rounded-2xl object-contain"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="secondary" size="sm" disabled={open === 0} onClick={() => (setOpen(open - 1), setConfirmDelete(false))} aria-label="Vorheriges Foto">
                ←
              </Button>
              <span className="rounded-full bg-surface px-3 py-1 text-sm font-extrabold">
                {open + 1} / {photos.length}
              </span>
              <Button variant="secondary" size="sm" disabled={open === photos.length - 1} onClick={() => (setOpen(open + 1), setConfirmDelete(false))} aria-label="Nächstes Foto">
                →
              </Button>
              {confirmDelete ? (
                <Button
                  size="sm"
                  disabled={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      dialog.current?.close();
                      hidePhoto(current.id);
                      await deletePhotoAction(current.id);
                    })
                  }
                >
                  Wirklich löschen
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(true)}>
                  Löschen
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => dialog.current?.close()}>
                Schließen
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
