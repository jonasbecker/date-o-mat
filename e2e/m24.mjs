// M24: design tour – every page and sub page (dark, the Garten look) on a 390×844 phone and on a
// small one (360×640), so a screen that does not fit stands out in e2e/shots/m24-*.png. Checks that
// nothing errors or overflows sideways, nothing overlaps (flower, bubble, tab bar, buttons) and no
// text is cut off (layout-audit.mjs).
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { mondayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { passFilter, pickIdea } from "./flow.mjs";
import { layoutAudit } from "./layout-audit.mjs";
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
const audit = async (page, label) => {
  const { issues } = await layoutAudit(page);
  check(`${label}: nothing overlaps or is cut off${issues.length ? ` (${issues.join("; ")})` : ""}`, issues.length === 0);
};
for (const [size, viewport] of [["", { width: 390, height: 844 }], ["small-", { width: 360, height: 640 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "de-DE", colorScheme: "dark" });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  // Push blocked by the browser – the longest texts (Setup banner, welcome), and what CI's Chromium reports.
  await ctx.addInitScript(() => Object.defineProperty(Notification, "permission", { get: () => "denied" }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  const tag = `${viewport.width}×${viewport.height}`;
  for (const [name, path] of ROUTES) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 }).catch((e) => console.log("GOTO", path, e.message.split("\n")[0]));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}m24-${size}dark-${name}.png` });
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    check(`${tag} ${path}: ok, no sideways scroll`, (res?.status() ?? 0) < 400 && !wide);
    await audit(page, `${tag} ${path}`);
  }
  // The planning flow, step by step (dots 2–4)
  await page.goto(`${BASE}/plan`);
  await page.getByRole("link", { name: "Date planen", exact: true }).click();
  await page.getByRole("heading", { name: "worauf lust?", exact: true }).waitFor({ timeout: 20000 });
  check(`${tag} flow: the filter is dot 2`, (await page.getByRole("img", { name: "Schritt 2 von 4" }).count()) > 0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}m24-${size}dark-flow-1.png` });
  await audit(page, `${tag} flow: filter`);
  await passFilter(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}m24-${size}dark-flow-2.png` });
  await audit(page, `${tag} flow: was?`);
  await pickIdea(page, "Sushi-Abend");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}m24-${size}dark-flow-3.png` });
  await audit(page, `${tag} flow: wann?`);
  await ctx.close();
}
// The swipe card on the phones people really have (Safari with its bars, SE, Pro Max, a PWA with
// safe areas): the info box (WO · DAUER · KOSTEN) is always whole, the card tightens instead.
for (const viewport of [
  { width: 390, height: 664 },
  { width: 375, height: 667 },
  { width: 390, height: 760 },
  { width: 430, height: 932 },
  { width: 360, height: 640 },
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "de-DE", colorScheme: "dark" });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const page = await ctx.newPage();
  const tag = `${viewport.width}×${viewport.height}`;
  await page.goto(`${BASE}/ideas/entdecken`);
  await page.locator("[data-card-info]").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}m24-card-${tag}.png` });
  const fit = await page.evaluate(() => {
    const card = [...document.querySelectorAll("[data-card-dense]")].find((el) => el.getBoundingClientRect().height > 0);
    const info = card?.querySelector("[data-card-info]");
    if (!card || !info) return null;
    const c = card.getBoundingClientRect();
    const i = info.getBoundingClientRect();
    return { whole: i.bottom <= c.bottom - 4 && i.top >= c.top, dense: card.getAttribute("data-card-dense") };
  });
  check(`${tag} swipe card: WO · DAUER · KOSTEN whole (step ${fit?.dense})`, fit?.whole === true);
  await audit(page, `${tag} swipe card`);
  await ctx.close();
}
// The box shrinks after the first fit (an iPhone: safe areas, the page settling): the card fits again.
// And grows back when there is room.
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, locale: "de-DE", colorScheme: "dark" });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ideas/entdecken`);
  await page.locator("[data-card-info]").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  const whole = () =>
    page.evaluate(() => {
      const card = [...document.querySelectorAll("[data-card-dense]")].find((el) => el.getBoundingClientRect().height > 0);
      const info = card?.querySelector("[data-card-info]");
      if (!card || !info) return null;
      return { whole: info.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 4, dense: Number(card.getAttribute("data-card-dense")) };
    });
  const roomy = await whole();
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(600);
  const shrunk = await whole();
  await page.screenshot({ path: `${OUT}m24-card-shrunk.png` });
  check(`swipe card refits when its box shrinks (step ${roomy?.dense} → ${shrunk?.dense})`, shrunk?.whole === true && shrunk.dense > (roomy?.dense ?? 0));
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(600);
  const grown = await whole();
  check(`…and is roomy again when it grows (step ${grown?.dense})`, grown?.whole === true && grown.dense === roomy?.dense);
  // Like on the phone: the tab bar moves between pages (Next keeps the swipe page, hidden), the screen
  // changes meanwhile, back on Swipen the card must fit what it has now.
  await page.getByRole("link", { name: "Beet" }).click();
  await page.waitForURL(`${BASE}/plan`);
  await page.setViewportSize({ width: 390, height: 664 });
  await page.waitForTimeout(400);
  await page.getByRole("link", { name: "Swipen" }).click();
  await page.waitForURL(`${BASE}/ideas/entdecken`);
  await page.waitForTimeout(800);
  const back = await whole();
  await page.screenshot({ path: `${OUT}m24-card-back.png` });
  check(`back on Swipen after the screen changed while it was hidden: whole (step ${back?.dense})`, back?.whole === true && back.dense > 0);
  await ctx.close();
}
// Without the measuring (before hydration, or should it fail on some browser): on an iPhone as an app
// (390×763 – 844 minus status bar and home bar) the picture alone gives way and the info box stays whole.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 763 }, deviceScaleFactor: 1, locale: "de-DE", colorScheme: "dark" });
  await ctx.addInitScript(() => (window.__noCardFit = true));
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/ideas/entdecken`);
  await page.locator("[data-card-info]").first().waitFor({ timeout: 20000 });
  const fit = await page.evaluate(() => {
    const card = [...document.querySelectorAll("[data-card-dense]")].find((el) => el.getBoundingClientRect().height > 0);
    const info = card?.querySelector("[data-card-info]");
    return card && info ? info.getBoundingClientRect().bottom <= card.getBoundingClientRect().bottom - 4 : null;
  });
  await page.screenshot({ path: `${OUT}m24-card-nojs.png` });
  check("no measuring, 390×763: the picture gives way, WO · DAUER · KOSTEN whole", fit === true);
  await ctx.close();
}
// The five moods of the flower side by side (/dev/blume), to compare with BloomStates.html
const wide = await browser.newContext({ viewport: { width: 1800, height: 720 }, locale: "de-DE", colorScheme: "dark" });
await wide.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
const bp = await wide.newPage();
await bp.goto(`${BASE}/dev/blume`);
await bp.waitForTimeout(600);
await bp.screenshot({ path: `${OUT}m24-blume.png` });
check("all five moods on /dev/blume", (await bp.locator("[data-bloom]").count()) === 5);
// The picture strip's drawings on all pastels (SWIPE-KARTE.md §4)
await bp.setViewportSize({ width: 1200, height: 900 });
await bp.goto(`${BASE}/dev/illustrationen`);
await bp.waitForTimeout(500);
await bp.screenshot({ path: `${OUT}m24-illustrationen.png`, fullPage: true });
check("every illustration on /dev/illustrationen", (await bp.locator("[data-dev-illustration]").count()) >= 20);
await wide.close();

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
