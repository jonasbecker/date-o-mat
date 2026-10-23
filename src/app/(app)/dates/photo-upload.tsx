"use client";

// Photos onto a leaf (the leaf page's "+", "wie war's?"): each one shrunk in the browser first (long edge ~2000 px, a
// thumbnail for stem and grid – core/photos.ts, lib/resize-image.ts), then sent one by one.
import { useRef, useState } from "react";
import { PHOTO_LIMITS } from "@/lib/domain";
import { resizePhoto } from "@/lib/resize-image";
import { uploadPhotoAction } from "./actions";

export function usePhotoUpload(dateId: string, count: number) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const remaining = Math.max(0, PHOTO_LIMITS.perDate - count);

  async function upload(files: FileList) {
    const list = Array.from(files).slice(0, remaining);
    setMessage(files.length > remaining ? (remaining ? `Es passen nur noch ${remaining} Fotos dazu.` : `Mehr als ${PHOTO_LIMITS.perDate} Fotos passen nicht aufs Blatt.`) : null);
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

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      aria-label="Fotos wählen"
      data-photo-input
      onChange={(event) => event.target.files?.length && upload(event.target.files)}
    />
  );
  return { fileInput, pick: () => input.current?.click(), progress, message, remaining };
}
