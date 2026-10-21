import "server-only";
import { sql } from "drizzle-orm";
import { STAMPED, type StampScope } from "@/core/stamp-tables";
import { db } from "@/server/db";
import { CLIENT_ERRORS_KEY, ERRORS_KEY } from "@/server/server-errors";

/**
 * A fingerprint of everything the couple's pages show: per table the number of rows and the newest row
 * version (Postgres' `xmin` changes with every insert and update, the count with every delete). AutoRefresh
 * compares it instead of re-rendering the page every few seconds – a refresh drops the browser's copies of
 * all visited pages, so it should only happen when something really changed. Which tables: core/stamp-tables.ts.
 */
export async function coupleStamp(coupleId: string | null, userId: string): Promise<string> {
  const c = coupleId ?? "00000000-0000-0000-0000-000000000000";
  const row = (table: string, where: ReturnType<typeof sql>) =>
    sql`select ${table}::text as t, count(*)::text || '.' || coalesce(max(xmin::text::bigint), 0)::text as v from ${sql.raw(table)} where ${where}`;
  const people = sql`(select id from users where couple_id = ${c} or id = ${userId})`;
  const dates = sql`(select id from date_plans where couple_id = ${c})`;
  const where: Record<StampScope, ReturnType<typeof sql>> = {
    people: sql`user_id in ${people}`,
    couple: sql`couple_id = ${c}`,
    dates: sql`date_id in ${dates}`,
    cycles: sql`cycle_id in (select id from cycles where couple_id = ${c})`,
    sources: sql`source_id in (select id from event_sources where couple_id = ${c})`,
    // Errors are not page data: a failing page must not refresh itself in a loop.
    status: sql`key not in (${ERRORS_KEY}, ${CLIENT_ERRORS_KEY})`,
  };
  // The people themselves: their own rows, not via user_id.
  const parts = Object.entries(STAMPED).map(([table, scope]) => row(table, table === "users" ? sql`id in ${people}` : where[scope]));
  // The settings row also holds bookkeeping: of a deck refill only whether one runs counts ("Neue Ideen werden
  // gemischt"), not when it started.
  parts.push(
    sql`select 'couple_settings'::text as t, coalesce(max(md5((to_jsonb(s) - 'deck_refill_started_at' - 'updated_at')::text || (s.deck_refill_started_at is null)::text)), '') as v from couple_settings s where couple_id = ${c}`,
  );
  const { rows } = await db.execute<{ t: string; v: string }>(sql.join(parts, sql` union all `));
  return rows.map((r) => `${r.t}:${r.v}`).join(",");
}
