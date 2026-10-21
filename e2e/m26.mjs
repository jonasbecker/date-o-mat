// Switching tabs feels like an app: a tab visited a moment ago comes back at once – no loading skeleton,
// no fade-in (the client keeps visited pages, AutoRefresh brings them up to date quietly).
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
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
// The fingerprint also turns over every 5 minutes (a planned refresh) – run inside one such window.
const toTurn = 300_000 - (Date.now() % 300_000);
if (toTurn < 75_000) await new Promise((r) => setTimeout(r, toTurn + 1000));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
const j = await ctx.newPage();
j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await j.goto(`${BASE}/plan`);
await j.locator('[data-date-sheet="zu"] [data-sheet-flower]').waitFor({ timeout: 20000 });
await j.waitForTimeout(1500);

const bar = j.getByRole("navigation", { name: "Hauptmenü" });
/**
 * Taps a tab and watches every frame until `ready` shows: did a loading skeleton show, did the page fade
 * (main's content below full opacity), how long until the page was there.
 */
async function tap(label, ready) {
  await j.evaluate(() => {
    const seen = { skeleton: false, faded: false };
    window.__frames = seen;
    const tick = () => {
      if (document.querySelector('main [aria-busy="true"]')) seen.skeleton = true;
      for (let el = document.querySelector("main")?.firstElementChild; el; el = el.firstElementChild) {
        if (Number(getComputedStyle(el).opacity) < 0.99) seen.faded = true;
        if (el.matches("[data-screen] > * > *")) break;
      }
      if (!seen.stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await bar.getByRole("link", { name: label, exact: true }).click();
  await j.locator(ready).filter({ visible: true }).first().waitFor({ timeout: 20000 });
  const ms = Date.now() - t0;
  await j.waitForTimeout(300);
  const seen = await j.evaluate(() => ((window.__frames.stop = true), window.__frames));
  return { ...seen, ms };
}

const TABS = [
  ["Archiv", 'h1:text-is("archiv.")'],
  ["Ideen", 'h1:text-is("ideen.")'],
  ["Einstellungen", 'h1:text-is("einstellungen.")'],
  ["Swipen", "[data-swipe-deck]"],
  ["Beet", "[data-date-sheet] [data-sheet-flower]"],
];
for (const [label, ready] of TABS) {
  const r = await tap(label, ready);
  check(`first visit ${label}: no skeleton, no fade (${JSON.stringify(r)})`, !r.skeleton && !r.faded);
}
// Each tab again: it was there a moment ago – it must come back at once, without skeleton or fade.
for (const [label, ready] of TABS) {
  const r = await tap(label, ready);
  check(`back to ${label}: no skeleton, no fade (${JSON.stringify(r)})`, !r.skeleton && !r.faded);
}
// AutoRefresh asks every 15 s whether anything changed – nothing did, so the copies survive.
await j.waitForTimeout(17_000);
for (const [label, ready] of TABS.slice(0, 2)) {
  const r = await tap(label, ready);
  check(`after a quiet AutoRefresh round, ${label} is still there at once (${JSON.stringify(r)})`, !r.skeleton && !r.faded);
}
// Sam changes something: it still shows up by itself.
await tap("Beet", "[data-date-sheet] [data-sheet-flower]");
await db.query("UPDATE date_plans SET title = 'Picknick im Park' WHERE id = $1", [date.id]);
await j.getByText("Picknick im Park").first().waitFor({ timeout: 25_000 }).catch(() => {});
check("a change by Sam shows up by itself", await j.getByText("Picknick im Park").first().isVisible());
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
