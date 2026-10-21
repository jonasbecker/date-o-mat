import { requireCouple } from "@/server/auth/dal";
import { badgeFor } from "@/server/badge";
import { AppBadge } from "./app-badge";

/** The app icon's number while the app is open (reads the database, so it sits in its own Suspense). */
export async function AppBadgeCount() {
  return <AppBadge count={await badgeFor(await requireCouple())} />;
}
