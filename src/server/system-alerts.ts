// Pushes for things a person has to fix – right when they break.
import "server-only";
import { eq } from "drizzle-orm";
import { genitive } from "@/lib/format";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { sendToUser } from "@/server/push";

/** A calendar connection was just lost (Google revoked the grant): tell both. */
export async function notifyCalendarLost(userId: string): Promise<void> {
  try {
    const [owner] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!owner) return;
    await sendToUser(
      owner.id,
      {
        title: "Kalender getrennt 🔌",
        body: "Google hat die Verbindung zu deinem Kalender beendet. Tippe hier und verbinde ihn neu – sonst findet der Date-O-Mat keine freien Zeiten.",
        url: "/settings?t=kalender",
        tag: "calendar-lost",
      },
      "system",
    );
    if (!owner.coupleId) return;
    const members = await db.select().from(users).where(eq(users.coupleId, owner.coupleId));
    const partner = members.find((m) => m.id !== owner.id);
    if (!partner) return;
    await sendToUser(
      partner.id,
      {
        title: `${genitive(owner.name)} Kalender ist getrennt 🔌`,
        body: `Solange gibt's keine gemeinsamen freien Zeiten. Sag ${owner.name} Bescheid: einmal in den Einstellungen neu verbinden, dann läuft wieder alles.`,
        url: "/settings?t=status",
        tag: "calendar-lost",
      },
      "system",
    );
  } catch (error) {
    console.warn("[alerts] calendar-lost push failed", error instanceof Error ? error.message : error);
  }
}
