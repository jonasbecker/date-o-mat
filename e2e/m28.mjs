// Database round trips per page: every page is fetched once (as the browser does on a first visit) and the
// database's own transaction counter says how many statements it took. A page that suddenly needs far more
// is a slowdown on phones. `QUERY_BUDGETS='{"/plan":1}' npm run e2e -- m28` prints the numbers.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { tuesdayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { startMock } from "./google-mock.mjs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const ZONE = "Europe/Berlin";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
const encrypt = (text) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
};
await startMock(4010);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions, ideas");
const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
async function makeUser(name, email, color, accessToken, createdAt) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color, createdAt],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  await db.query(
    `INSERT INTO google_connections (user_id, refresh_token_enc, access_token_enc, access_token_expires_at, busy_calendar_ids)
     VALUES ($1, $2, $3, now() + interval '30 days', '{primary}')`,
    [rows[0].id, encrypt("fake-refresh"), encrypt(accessToken)],
  );
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas", "2026-01-01");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
const offset = tuesdayMorningOffset();
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, offset]);
// Push is on for both, so the bubble says the flower's line (not the reminder hint).
for (const u of [jonas, sam]) {
  await db.query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, 'k', 'a')", [u.id, `https://push.example/${u.id}`]);
}
// This week's round with Sam's date on Friday, which Jonas said yes to.
const monday = DateTime.now().setZone(ZONE).startOf("week");
const { rows: [cycle] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status)
   VALUES ($1, 1, $2, $3, $4, 'alternating', $5, 'confirmed') RETURNING id`,
  [couple.id, monday.toJSDate(), monday.plus({ weeks: 1 }).toJSDate(), monday.plus({ days: 3, hours: 20 }).toJSDate(), sam.id],
);
const start = monday.plus({ days: 4 }).set({ hour: 19, minute: 30 });
const { rows: [date] } = await db.query(
  `INSERT INTO date_plans (couple_id, cycle_id, title, size, starts_at, ends_at, location, note, organizer_id, proposed_by_id, status, sync_status, confirmed_by_id, confirmed_at)
   VALUES ($1, $2, 'Zweizeiler-Schnitzeljagd durch die Altstadt', 'small', $3, $4, 'Alter Markt', 'ich hab schon den ersten reim!', $5, $5, 'confirmed', 'synced', $6, now()) RETURNING id`,
  [couple.id, cycle.id, start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), sam.id, jonas.id],
);
for (const title of ["Stift", "Handy-Akku", "warme Jacke"]) await db.query("INSERT INTO date_tasks (date_id, title) VALUES ($1, $2)", [date.id, title]);

// A full deck: nothing gets refilled while the test runs (a refill is a real change – it would refresh).
for (let i = 0; i < 12; i++) {
  await db.query("INSERT INTO deck_cards (couple_id, kind, title, size, dedupe_key, batch) VALUES ($1, 'idea', $2, 'small', $2, 1)", [couple.id, `Karte ${i + 1}`]);
}


let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
// Statements so far (autocommit statements and transactions each count one) – the stats settle about a second late.
const counter = async () => (await db.query("SELECT xact_commit + xact_rollback AS n FROM pg_stat_database WHERE datname = current_database()")).rows[0].n * 1;
async function settled() {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 700));
    const n = await counter();
    if (n === last) return n;
    last = n;
  }
  return last;
}
const cookie = `dom_session=${jonas.token}`;
async function cost(path, init = {}) {
  await db.query("SELECT $1::text AS marker", [`MARK ${path}`]); // a landmark in the database log (log_statement = all)
  const before = await settled();
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { cookie, ...(init.headers ?? {}) }, redirect: "manual" });
  await res.text();
  const after = await settled();
  // The two settled() reads themselves each cost one.
  return { status: res.status, n: after - before - 1 };
}

// The first request after a build compiles/warms things – not measured.
await cost("/plan");
const pages = { "/plan": 0, "/ideas/entdecken": 0, "/ideas": 0, "/dates": 0, "/settings": 0, "/budget": 0 };
// Measured (Oct 2026): /plan 34, /ideas/entdecken 29, /ideas 24, /dates 16, /settings 24, /budget 20 – the counter
// wobbles by a few (the database's statistics arrive late), so the budgets are far enough above to mean "doubled".
const budgets = { "/plan": 46, "/ideas/entdecken": 40, "/ideas": 32, "/dates": 24, "/settings": 32, "/budget": 28, ...JSON.parse(process.env.QUERY_BUDGETS ?? "{}") };
for (const path of Object.keys(pages)) {
  const { status, n } = await cost(path);
  pages[path] = n;
  console.log(`  ${path}: ${n} statements (${status})`);
}
console.log(`  JSON ${JSON.stringify(pages)}`);
for (const [path, n] of Object.entries(pages)) {
  if (budgets[path] !== undefined) check(`${path} stays within ${budgets[path]} statements (${n})`, n <= budgets[path]);
}

await db.end();
process.exit(failures ? 1 : 0);
