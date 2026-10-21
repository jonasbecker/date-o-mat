import { stampAction } from "@/app/stamp-action";
import { AutoRefreshClient } from "./auto-refresh-client";

/**
 * Keeps the page fresh (see AutoRefreshClient): it carries the couple's fingerprint it was rendered with, so
 * a change right after rendering – or while the page waited as the browser's copy – is not missed.
 * Reads the session: render it inside the page's <Suspense>.
 */
export async function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  return <AutoRefreshClient stamp={await stampAction()} intervalMs={intervalMs} />;
}
