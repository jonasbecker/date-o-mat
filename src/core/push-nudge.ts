// Reminders are what keeps the couple from forgetting dates – so the start page asks for them
// until they are on. Pure decisions, no browser or database.

export type PushRow = "mine" | "partner";

export const PARTNER_ROW_SNOOZE_MS = 7 * 86_400_000;

/**
 * Which line the start page shows about reminders:
 * - "mine" as long as I have no device registered – no way to dismiss it,
 * - "partner" when I am fine but the other person has none (can be snoozed for a week),
 * - nothing when the server has no push keys or everyone is set up.
 */
export function pushRow(facts: { configured: boolean; myDevices: number; partnerDevices: number; partnerSnoozedAt: number | null; now: number }): PushRow | null {
  if (!facts.configured) return null;
  if (facts.myDevices === 0) return "mine";
  if (facts.partnerDevices > 0) return null;
  if (facts.partnerSnoozedAt !== null && facts.now - facts.partnerSnoozedAt < PARTNER_ROW_SNOOZE_MS) return null;
  return "partner";
}

export type DeniedHelp = { where: "ios" | "android" | "desktop"; steps: string[] };

/** How to allow notifications again after the browser said no. */
export function deniedHelp(userAgent: string, maxTouchPoints = 0): DeniedHelp {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Macintosh") && maxTouchPoints > 1);
  if (ios) {
    return { where: "ios", steps: ["Öffne die Einstellungen deines iPhones.", "Tippe auf „Mitteilungen“ und dann auf „Date-O-Mat“.", "Schalte „Mitteilungen erlauben“ ein.", "Öffne den Date-O-Mat neu und tippe auf „Aktivieren“."] };
  }
  if (/Android/.test(userAgent)) {
    return { where: "android", steps: ["Tippe oben im Browser auf das Schloss oder auf ⋮ → „Einstellungen für diese Website“.", "Stelle „Benachrichtigungen“ auf „Zulassen“.", "Lade die Seite neu und tippe auf „Aktivieren“."] };
  }
  return { where: "desktop", steps: ["Klicke links neben der Adresse auf das Schloss-Symbol.", "Stelle „Benachrichtigungen“ auf „Zulassen“.", "Lade die Seite neu und klicke auf „Aktivieren“."] };
}
