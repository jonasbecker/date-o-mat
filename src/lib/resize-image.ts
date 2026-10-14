// Browser only: shrinks a photo before upload (saves data and storage, and the
// re-encoding drops EXIF metadata such as the GPS position).
import { fitWithin } from "@/core/photos";

export type ResizedPhoto = { full: Blob; thumb: Blob; width: number; height: number };

async function encode(bitmap: ImageBitmap, edge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, edge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("encoding failed");
  return { blob, width, height };
}

export async function resizePhoto(file: File, fullEdge: number, thumbEdge: number): Promise<ResizedPhoto> {
  // imageOrientation: photos taken upright stay upright (EXIF rotation is applied).
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await encode(bitmap, fullEdge, 0.84);
    const thumb = await encode(bitmap, thumbEdge, 0.78);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}
