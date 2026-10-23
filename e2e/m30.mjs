// M30: the swipe card under a real finger (touch events, a phone): swiped small and full, a slightly shaky swipe still
// counts, in full the text scrolls and the map is only a picture – a tap on it makes the card small, Maps has its own
// button.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { tuesdayMorningOffset } from "./clock.mjs";
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
await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset()]);


let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
for (let i = 0; i < 8; i++) {
  await db.query("INSERT INTO deck_cards (couple_id, kind, title, note, size, cost_eur, location, dedupe_key, batch) VALUES ($1, 'idea', $2, $3, 'small', 12, 'Ehrenfeld', $2, 1)", [
    couple.id,
    `Karte ${i}`,
    "Eine längere Beschreibung, damit die große Karte etwas zu scrollen hat. ".repeat(8),
  ]);
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", hasTouch: true, isMobile: true });
// Google's map and Maps itself – stand-ins.
await ctx.route("https://maps.google.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body style='margin:0;background:#cfe3d0'></body></html>" }));
await ctx.route("https://www.google.com/maps/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>maps</body></html>" }));
await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
const j = await ctx.newPage();
j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await j.goto(`${BASE}/ideas/entdecken`);
const card = j.locator('[aria-roledescription="Karte"]');
await card.waitFor({ timeout: 20000 });
await j.waitForTimeout(1000);
const cdp = await ctx.newCDPSession(j);
const touch = async (pts) => {
  const [first, ...rest] = pts;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
  for (const p of rest) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [p] });
    await j.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await j.waitForTimeout(600);
};
const title = () => card.getAttribute("aria-label");
const isFull = async () => (await j.locator("[data-swipe-deck][data-full]").count()) === 1;
/** A swipe to the right, `shake` px down over its first steps (a thumb is never quite straight). */
const swipe = async (shake = 0, at = 0.5) => {
  const b = await card.boundingBox();
  const pts = [];
  for (let i = 0; i <= 14; i++) pts.push({ x: b.x + 70 + i * 17, y: b.y + b.height * at + Math.min(i, 4) * shake });
  await touch(pts);
};

/**
 * Halfway through a swipe (the finger still down): where the card was, the real next card shows – its title, not an
 * empty shape. Then the finger goes back and lets go (the card springs back).
 */
const peek = async (shot) => {
  const b = await card.boundingBox();
  const y = b.y + b.height * 0.4;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b.x + 60, y }] });
  for (let i = 1; i <= 8; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: b.x + 60 + i * 20, y }] });
    await j.waitForTimeout(16);
  }
  await j.waitForTimeout(100);
  // The spot the card left (its left part): the top card is no longer there, the next card is (it takes no
  // pointer, so elementFromPoint does not see it – the boxes do).
  const seen = await j.evaluate(({ x, y }) => {
    const inside = (el, px, py) => {
      const r = el.getBoundingClientRect();
      return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
    };
    const top = document.querySelector('[aria-roledescription="Karte"]');
    const behind = document.querySelector("[data-next-card]");
    if (!top || !behind || inside(top, x, y) || !inside(behind, x, y) || getComputedStyle(behind).visibility === "hidden") return null;
    return behind.querySelector("h2")?.textContent ?? "";
  }, { x: b.x + 30, y: b.y + b.height * 0.3 });
  if (shot) await j.screenshot({ path: `${OUT}${shot}` });
  const next = await j.locator("[data-next-card] h2").textContent();
  for (let i = 7; i >= 0; i--) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: b.x + 60 + i * 20, y }] });
    await j.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await j.waitForTimeout(400);
  return { seen, next };
};

{
  const p = await peek("m30-00-dahinter-klein.png");
  check(`small: mid-swipe the next card shows behind (${JSON.stringify(p)})`, Boolean(p.seen) && p.seen === p.next);
}
{
  const before = await title();
  await swipe(0);
  check(`small: a swipe right by finger plants it (${before} → ${await title()})`, (await title()) !== before && !(await isFull()));
}
{
  const b = await card.boundingBox();
  await touch([{ x: b.x + b.width / 2, y: b.y + 120 }]);
  check("a tap opens it to the full screen", await isFull());
}
{
  const p = await peek("m30-00-dahinter-voll.png");
  check(`full: mid-swipe the next card shows behind, full as well (${JSON.stringify(p)})`, Boolean(p.seen) && p.seen === p.next && (await j.locator("[data-next-card] [data-card-full]").count()) === 1 && (await isFull()));
}
for (const shake of [0, 3, 8]) {
  const before = await title();
  await swipe(shake);
  check(`full: a swipe by finger (${shake} px shaky) goes on to the next card, still full (${before} → ${await title()}), the page stays`, (await title()) !== before && (await isFull()) && j.url() === `${BASE}/ideas/entdecken`);
}
{
  // Straight up: the long text scrolls, nothing is swiped.
  const before = await title();
  const b = await card.boundingBox();
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push({ x: b.x + b.width / 2, y: b.y + b.height * 0.75 - i * 25 });
  await touch(pts);
  const scrolled = await card.locator("[data-card-full]").evaluate((el) => el.scrollTop);
  check(`full: up and down the text scrolls, the card stays (${scrolled} px)`, scrolled > 20 && (await title()) === before && (await isFull()));
}
{
  // The map is only a picture: a tap on it makes the card small, it opens nothing.
  const map = card.locator("[data-card-full] [data-map-embed]");
  await map.scrollIntoViewIfNeeded();
  await j.waitForTimeout(300);
  check("full: the map is no link", (await map.evaluate((el) => el.tagName)) === "DIV" && (await card.locator("[data-card-full] [data-maps-link]").count()) === 1);
  await j.screenshot({ path: `${OUT}m30-01-vollbild-karte.png` });
  const pages = ctx.pages().length;
  const m = await map.boundingBox();
  await touch([{ x: m.x + m.width / 2, y: m.y + m.height / 2 }]);
  check(`a tap on the map makes the card small – no Maps (${ctx.pages().length - pages} new pages)`, !(await isFull()) && ctx.pages().length === pages && j.url() === `${BASE}/ideas/entdecken`);
}
{
  // Maps has its own button.
  const b = await card.boundingBox();
  await touch([{ x: b.x + b.width / 2, y: b.y + 120 }]);
  const link = card.locator("[data-card-full] [data-maps-link]");
  await link.scrollIntoViewIfNeeded();
  const popup = ctx.waitForEvent("page", { timeout: 5000 }).catch(() => null);
  const l = await link.boundingBox();
  await touch([{ x: l.x + l.width / 2, y: l.y + l.height / 2 }]);
  const opened = await popup;
  check(`"In Google Maps öffnen" opens Maps (${opened?.url()}), the card stays full`, Boolean(opened?.url().includes("google.com/maps")) && (await isFull()));
}

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
