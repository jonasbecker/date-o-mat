// M24: design tour – every page and sub page in light and dark, so a screen that does not
// belong to the "Pastell & rund" look stands out in e2e/shots/m24-*.png. Checks that nothing
// errors or overflows sideways.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { mondayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { startMock } from "./google-mock.mjs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
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
async function makeUser(name, email, color, accessToken) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, '2026-01-01', now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  await db.query(
    `INSERT INTO google_connections (user_id, refresh_token_enc, access_token_enc, access_token_expires_at, busy_calendar_ids)
     VALUES ($1, $2, $3, now() + interval '1 hour', '{primary}')`,
    [rows[0].id, encrypt("fake-refresh"), encrypt(accessToken)],
  );
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, mondayMorningOffset()]);
const idea = (title, size, setting, by = jonas.id) =>
  db.query("INSERT INTO ideas (couple_id, title, size, setting, created_by_id) VALUES ($1, $2, $3, $4, $5) RETURNING id", [couple.id, title, size, setting, by]);
const { rows: [picnic] } = await idea("Picknick im Stadtwald", "small", "outdoor");
await db.query("UPDATE ideas SET note = 'Decke, Käse, Wein – und Frisbee nicht vergessen.', location = 'Stadtwald, Weiher', cost_eur = 15 WHERE id = $1", [picnic.id]);
await idea("Sushi-Abend", "small", "indoor", sam.id);
await idea("Ausflug nach Bonn", "large", "outdoor");
await idea("Töpferkurs", "small", "indoor", sam.id);
const now = DateTime.now().setZone("Europe/Berlin");
const { rows: [cycle] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status)
   VALUES ($1, 1, $2, $3, $4, 'alternating', $5, 'done') RETURNING id`,
  [couple.id, now.minus({ days: 20 }).toJSDate(), now.minus({ days: 10 }).toJSDate(), now.minus({ days: 12 }).toJSDate(), jonas.id],
);
const past = now.minus({ days: 14 }).set({ hour: 19 });
const { rows: [done] } = await db.query(
  `INSERT INTO date_plans (couple_id, cycle_id, title, size, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status, estimated_cost_eur)
   VALUES ($1, $2, 'Kino', 'small', $3, $4, $5, $5, 'done', 'synced', 24) RETURNING id`,
  [couple.id, cycle.id, past.toJSDate(), past.plus({ hours: 2 }).toJSDate(), jonas.id],
);
await db.query("INSERT INTO date_reviews (date_id, user_id, rating) VALUES ($1, $2, 5), ($1, $3, 4)", [done.id, jonas.id, sam.id]);

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ROUTES = [
  ["plan", "/plan"],
  ["flow", "/plan?pick=1"],
  ["ideas", "/ideas"],
  ["ideas-all", "/ideas?ansicht=alle"],
  ["idea", `/ideas?ansicht=alle&idee=${picnic.id}`],
  ["swipe", "/ideas/entdecken"],
  ["koeln", "/ideas/koeln"],
  ["archive", "/dates"],
  ["date", `/dates/${done.id}`],
  ["events", "/events"],
  ["budget", "/budget"],
  ["fragen", "/fragen"],
  ["share", "/share"],
  ["story", "/story"],
  ["settings", "/settings"],
  ["s-mehr", "/settings?t=mehr"],
  ["s-darstellung", "/settings?t=darstellung"],
  ["s-push", "/settings?t=push"],
  ["s-zeiten", "/settings?t=zeiten"],
  ["s-events", "/settings?t=events"],
  ["s-entdecken", "/settings?t=entdecken"],
  ["s-besondere", "/settings?t=besondere-tage"],
  ["s-extras", "/settings?t=extras"],
  ["s-kalender", "/settings?t=kalender"],
  ["s-status", "/settings?t=status"],
  ["welcome", "/welcome"],
];
for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "de-DE", colorScheme: scheme });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  for (const [name, path] of ROUTES) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch((e) => console.log("GOTO", path, e.message.split("\n")[0]));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}m24-${scheme}-${name}.png` });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(`${scheme} ${path}: ok, no sideways scroll`, (res?.status() ?? 0) < 400 && !wide);
  }
  await ctx.close();
}
// Logged out
const anon = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE" });
const ap = await anon.newPage();
for (const [name, path] of [["login", "/login"], ["pair", "/pair"]]) {
  await ap.goto(`${BASE}${path}`);
  await ap.waitForTimeout(500);
  await ap.screenshot({ path: `${OUT}m24-light-${name}.png` });
}
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
