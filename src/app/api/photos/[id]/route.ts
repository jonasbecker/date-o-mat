import { type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { getPhoto } from "@/server/photos";
import { photoStore } from "@/server/photos/store";

// Photos are private: every request checks the login and that the photo belongs to the couple.
export async function GET(request: NextRequest, { params }: RouteContext<"/api/photos/[id]">) {
  const user = await getSessionUser();
  if (!user?.coupleId) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  const photo = /^[0-9a-f-]{36}$/.test(id) ? await getPhoto(user.coupleId, id) : undefined;
  const store = photoStore();
  if (!photo || !store) return new Response("not found", { status: 404 });

  const file = await store.read(request.nextUrl.searchParams.get("size") === "thumb" ? photo.thumbPath : photo.fullPath);
  if (!file) return new Response("not found", { status: 404 });
  return new Response(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      // Content under a photo id never changes; only this browser may keep it.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
