// The iPhone share shortcut: "Teilen → Date-O-Mat" in TikTok/Instagram sends
// the link here with the personal key; the idea lands on the wishlist right
// away. The answer is plain text – the shortcut shows it as a notification.
import { and, eq, ne } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { shareKeyFromHeader } from "@/core/date-extras";
import { isEmailAllowed } from "@/lib/allowlist";
import { IDEA_LIMITS } from "@/lib/idea-input";
import { coupleNow } from "@/server/clock";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { env } from "@/server/env";
import { createIdea } from "@/server/ideas";
import { linkToIdea } from "@/server/link-ideas";
import { userByShareKey } from "@/server/profile";
import { getCoupleSettings } from "@/server/settings";

// Reading the link and asking Claude takes a few seconds.
export const maxDuration = 60;

const reply = (text: string, status = 200) => new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

async function readInput(request: NextRequest): Promise<string> {
  const raw = (await request.text()).slice(0, 4000);
  if ((request.headers.get("content-type") ?? "").includes("json")) {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      return [data.text, data.url, data.title].filter((v) => typeof v === "string").join(" ");
    } catch {
      return "";
    }
  }
  return raw;
}

export async function POST(request: NextRequest) {
  const key = shareKeyFromHeader(request.headers.get("authorization"));
  const user = key ? await userByShareKey(key) : undefined;
  if (!user || !user.coupleId || !isEmailAllowed(user.email, env().allowedEmails)) {
    return reply("Der Schlüssel stimmt nicht – erstell in den Einstellungen einen neuen.", 401);
  }
  const [partner] = await db
    .select()
    .from(users)
    .where(and(eq(users.coupleId, user.coupleId), ne(users.id, user.id)))
    .limit(1);
  if (!partner) return reply("Ihr seid noch nicht gekoppelt.", 409);
  const ctx = { user, partner, coupleId: user.coupleId };

  const input = await readInput(request);
  const now = coupleNow(await getCoupleSettings(ctx.coupleId));
  const result = await linkToIdea(ctx, input, now);
  if (!result.ok && result.error === "invalid") return reply("Da war kein Link drin.", 400);

  if (result.ok) {
    const d = result.draft;
    await createIdea(ctx.coupleId, user.id, { title: d.title, size: d.size, note: d.note, url: d.url.slice(0, IDEA_LIMITS.url), costEur: d.costEur, location: d.location, setting: null });
    return reply(`💡 Auf eurer Wunschliste: ${d.title}`);
  }
  // Unreadable (e.g. Instagram without preview): keep the link, the title comes later.
  if (result.url) await createIdea(ctx.coupleId, user.id, { title: "Idee aus einem Link", size: "small", note: null, url: result.url.slice(0, IDEA_LIMITS.url), costEur: null, location: null, setting: null });
  return reply("💡 Gespeichert – den Link konnten wir nicht lesen, gib der Idee in der App kurz einen Titel.");
}
