// iPhone gestures the installed app does not get from the system (components/gestures.tsx): swipe from the
// left edge = back where the page has a back arrow; pull down at the top = fetch the page fresh.
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
// Playwright's offline switch does not reach the service worker; routing does (Chromium, with this flag).
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true, isMobile: true });
await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
// The swipe back only runs in the installed app – this switches it on here.
await ctx.addInitScript(() => localStorage.setItem("dom-gestures", "1"));
const j = await ctx.newPage();
j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const cdp = await ctx.newCDPSession(j);

/** A finger from one point to another in `steps` moves over `ms`. */
async function finger(from, to, { ms = 300, steps = 12 } = {}) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await j.waitForTimeout(ms / steps);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const shift = () => j.locator("main[data-screen]").evaluate((m) => m.style.transform || "none");

// 1) From the left edge to the right: back to where the arrow leads
await j.goto(`${BASE}/settings?t=mehr`);
await j.locator("[data-back]").filter({ visible: true }).first().waitFor({ timeout: 20000 });
await finger({ x: 6, y: 400 }, { x: 70, y: 405 }, { ms: 500 });
await j.waitForTimeout(500);
check(`a short slow swipe springs back (${j.url()}, ${await shift()})`, j.url().endsWith("/settings?t=mehr") && (await shift()) === "none");
const moved = j.locator("main[data-screen]").evaluate(
  (m) => new Promise((done) => {
    const seen = () => /translateX\((?!0px)/.test(m.style.transform) && done(true);
    new MutationObserver(seen).observe(m, { attributes: true, attributeFilter: ["style"] });
    setTimeout(() => done(false), 3000);
  }),
);
await finger({ x: 6, y: 400 }, { x: 260, y: 410 }, { ms: 300 });
check("the page follows the finger to the right", await moved);
await j.waitForURL((u) => !u.search.includes("t=mehr"), { timeout: 10000 }).catch(() => {});
await j.getByRole("heading", { name: "einstellungen." }).waitFor({ timeout: 10000 }).catch(() => {});
await j.waitForTimeout(300);
check(`swiping from the left edge goes back (${j.url()})`, j.url().endsWith("/settings") && (await shift()) === "none");

// 2) A page without a back arrow (a tab): nothing happens
await finger({ x: 6, y: 400 }, { x: 260, y: 410 }, { ms: 300 });
await j.waitForTimeout(600);
check(`no back arrow, no swipe back (${j.url()})`, j.url().endsWith("/settings") && (await shift()) === "none");

// 3) At the top, pull down: fetched fresh
await db.query("UPDATE couple_settings SET flower_name = 'Gundula' WHERE couple_id = $1", [couple.id]);
check("before the pull the page still shows the old name", (await j.locator("[data-flower-name]").innerText()) !== "Gundula");
const seen = j.locator('[data-pull="refreshing"]').waitFor({ state: "attached", timeout: 5000 }).then(() => true, () => false);
await finger({ x: 200, y: 200 }, { x: 205, y: 420 }, { ms: 400 });
check("the sprout comes down and turns while it fetches", await seen);
await j.locator("[data-flower-name]").filter({ hasText: "Gundula" }).waitFor({ timeout: 10000 }).catch(() => {});
check("pulled down past the mark: the page is fresh", (await j.locator("[data-flower-name]").innerText()) === "Gundula");
await j.locator("[data-pull]").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
check("then the sprout goes away again", (await j.locator("[data-pull]").count()) === 0 && (await shift()) === "none");

// 4) Pulling on the date card does not refresh (the card has its own gesture)
await j.goto(`${BASE}/plan`);
await j.locator('[data-date-sheet="zu"] [data-sheet-flower]').waitFor({ timeout: 20000 });
await j.waitForTimeout(500);
const card = await j.locator("[data-sheet-card]").boundingBox();
const noPull = j.locator('[data-pull="refreshing"]').waitFor({ state: "attached", timeout: 1500 }).then(() => false, () => true);
await finger({ x: card.x + 100, y: card.y + 20 }, { x: card.x + 102, y: card.y + 200 }, { ms: 400 });
check("pulling the date card down does not refresh the page", await noPull);

// 5) Offline: the pages seen before are still there (their last state), a new one gets the offline page
for (let i = 0; i < 40 && !(await j.evaluate(() => Boolean(navigator.serviceWorker?.controller))); i++) await j.waitForTimeout(250);
check("the service worker looks after the pages", await j.evaluate(() => Boolean(navigator.serviceWorker?.controller)));
await j.goto(`${BASE}/dates`);
await j.getByRole("heading", { name: "archiv." }).waitFor({ timeout: 20000 });
await j.goto(`${BASE}/plan`);
await j.locator("[data-date-sheet] [data-sheet-flower]").waitFor({ timeout: 20000 });
// The copies are written after the page: wait until the page and all its code files are kept (slower in CI) –
// without them the offline page could not start and would never say it is offline.
for (let i = 0; i < 60; i++) {
  const kept = await j.evaluate(async () => {
    const pages = await caches.open("dom-pages-v1");
    if (!(await pages.match(location.href, { ignoreVary: true }))) return false;
    const code = await caches.open("dom-static-v1");
    const files = [...document.querySelectorAll("script[src]")].map((s) => s.src).filter((src) => src.includes("/_next/static/"));
    for (const src of files) if (!(await code.match(src))) return false;
    return true;
  });
  if (kept) break;
  await j.waitForTimeout(250);
}
// No network at all – for the page and for the service worker.
const cut = (route) => route.abort("internetdisconnected");
await ctx.route("**/*", cut);
await ctx.setOffline(true);
await j.reload();
await j.locator("[data-date-sheet]").waitFor({ timeout: 10000 }).catch(() => {});
check("offline, the Beet opens with its last state", await j.getByText("Zweizeiler-Schnitzeljagd durch die Altstadt").first().isVisible().catch(() => false));
await j.locator("[data-offline]").waitFor({ timeout: 10000 }).catch(() => {}); // after hydration – slower in CI
const saysOffline = await j.locator("[data-offline]").isVisible().catch(() => false);
check("…and says it is offline", saysOffline);
if (!saysOffline) console.log("    offline page:", await j.evaluate(() => ({ onLine: navigator.onLine, hydrated: Boolean(document.querySelector("main [data-date-sheet]") && Object.keys(document.querySelector("main") ?? {}).some((k) => k.startsWith("__react"))) })).catch((e) => e.message));
await j.screenshot({ path: `${OUT}m27-01-offline.png` });
await j.goto(`${BASE}/dates`).catch(() => {});
await j.getByRole("heading", { name: "archiv." }).waitFor({ timeout: 10000 }).catch(() => {});
check("offline, the Archiv opens too", await j.getByRole("heading", { name: "archiv." }).isVisible().catch(() => false));
await j.goto(`${BASE}/budget`).catch(() => {});
await j.getByRole("heading", { name: /Gerade offline/ }).waitFor({ timeout: 10000 }).catch(() => {});
check("a page never seen gets the offline page", await j.getByRole("heading", { name: /Gerade offline/ }).isVisible().catch(() => false));
await ctx.setOffline(false);
await ctx.unroute("**/*", cut);
// Signed out (the login page): the kept pages are gone
await db.query("DELETE FROM sessions WHERE user_id = $1", [jonas.id]);
await j.goto(`${BASE}/login`);
await j.waitForTimeout(1500);
check("on the login page the kept pages are forgotten", !(await j.evaluate(async () => (await caches.keys()).includes("dom-pages-v1"))));

await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
