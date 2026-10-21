// "date steht." (docs/design/garten/date-steht): the date card is a sheet – tap or pull it up, the flower
// gets pushed (sanft) or kicked (schubs), its bubble never covers anything; back closes it.
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

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(viewport, options = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: "de-DE", ...options });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.goto(`${BASE}/plan`);
  await page.locator('[data-date-sheet="zu"] [data-sheet-flower]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  return page;
}

const sheet = (page) => page.locator("[data-date-sheet]");
const state = async (page) => ({ z: await sheet(page).getAttribute("data-date-sheet"), tempo: await sheet(page).getAttribute("data-tempo"), mood: await page.locator("[data-sheet-flower] [data-bloom]").getAttribute("data-bloom") });
const settle = (page, ms = 1100) => page.waitForTimeout(ms);
const head = (page) => page.getByRole("button", { name: /^(Details (öffnen|schließen)|Weniger Details)$/ });

/** Nothing the bubble (and the closed flower) may cover: headline, subtitle, card, name, avatars, step bar. */
async function overlaps(page) {
  return page.evaluate(() => {
    const box = (el) => el && el.getBoundingClientRect();
    // What you actually see: the text of an element (not its full-width box), the shapes of the flower.
    const ink = (el) => {
      if (!el) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    };
    const union = (els) => {
      const rects = [...els].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      return { left: Math.min(...rects.map((r) => r.left)), top: Math.min(...rects.map((r) => r.top)), right: Math.max(...rects.map((r) => r.right)), bottom: Math.max(...rects.map((r) => r.bottom)), width: 1 };
    };
    const hit = (a, b) => a && b && a.width > 0 && b.width > 0 && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const bubble = box(document.querySelector("[data-sheet-bubble]"));
    const root = document.querySelector("[data-date-sheet]");
    const open = root.getAttribute("data-date-sheet") !== "zu";
    const above = document.querySelector("[data-sheet-above]");
    const header = document.querySelector("header");
    const centerEl = header.querySelector("[data-header-center]");
    const things = {
      headline: ink(root.querySelector("h2")),
      card: box(document.querySelector("[data-sheet-card]")),
      name: ink(header.querySelector("a")),
      avatars: box(header.lastElementChild),
      ...(open ? {} : { subtitle: union(above.querySelectorAll("*")) }),
      ...(centerEl && getComputedStyle(centerEl).opacity !== "0" ? { steps: box(centerEl) } : {}),
    };
    const bad = Object.entries(things).filter(([, r]) => hit(bubble, r)).map(([k]) => k);
    // Closed: the pot stands on the card, not in it.
    const flower = union(document.querySelectorAll("[data-sheet-flower] svg :is(circle, ellipse, polygon, rect, path)"));
    if (!open && flower.bottom > things.card.top + 1) bad.push("flower-in-card");
    if (!open && above && flower.top < things.subtitle.bottom - 2) bad.push("flower-over-text");
    // The open flower stays beside the headline, under the avatars.
    if (open && hit(flower, things.headline)) bad.push("flower-over-headline");
    return bad;
  });
}

async function drag(page, { to, ms, steps }) {
  const b = await head(page).boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + 30;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x, y + ((to - y) * i) / steps);
    await page.waitForTimeout(ms / steps);
  }
  await page.mouse.up();
}

for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
  const tag = `${viewport.width}×${viewport.height}`;
  const j = await pageFor(viewport);
  check(`${tag}: no "Details ›" button any more`, (await j.getByRole("link", { name: "Details ›" }).count()) === 0);
  check(`${tag}: closed – the happy flower, "${await j.locator("[data-sheet-bubble]").innerText()}"`, JSON.stringify(await state(j)) === JSON.stringify({ z: "zu", tempo: "sanft", mood: "froh" }) && (await head(j).getAttribute("aria-expanded")) === "false");
  check(
    `${tag}: closed – only the title and when · where, the rest is covered`,
    (await j.locator("[data-sheet-details]").evaluate((el) => getComputedStyle(el).opacity)) === "0" &&
      (await j.getByText("✓ in beiden Kalendern").isVisible()) &&
      (await j.locator("[data-sheet-card]").evaluate((card) => {
        const chip = [...card.querySelectorAll("span")].find((e) => e.textContent.includes("in beiden Kalendern")).getBoundingClientRect();
        const meta = [...card.querySelectorAll("p")].find((e) => e.textContent.includes("Alter Markt")).getBoundingClientRect();
        const box = card.getBoundingClientRect();
        // The meta line inside, the chip already below the card's visible part (behind the tab bar).
        const nav = document.querySelector('nav[aria-label="Hauptmenü"]').getBoundingClientRect();
        return meta.bottom <= Math.min(box.bottom, nav.top) && chip.top >= nav.top - 20;
      })),
  );
  check(`${tag}: closed – nothing covered (${(await overlaps(j)).join(", ")})`, (await overlaps(j)).length === 0);
  const cardBox = await j.locator("[data-sheet-card]").boundingBox();
  const nav = await j.getByRole("navigation", { name: "Hauptmenü" }).boundingBox();
  check(`${tag}: the card ends just above the tab bar (${Math.round(cardBox.y + cardBox.height)} / ${Math.round(nav.y)})`, cardBox.y + cardBox.height <= nav.y && nav.y - (cardBox.y + cardBox.height) < 30);
  await j.screenshot({ path: `${OUT}m25-01-zu${viewport.width === 390 ? "" : "-small"}.png` });

  // Tap → open, gently
  await head(j).click();
  await settle(j);
  check(`${tag}: a tap opens it gently (${JSON.stringify(await state(j))})`, JSON.stringify(await state(j)) === JSON.stringify({ z: "mitte", tempo: "sanft", mood: "genervt" }) && (await head(j).getAttribute("aria-expanded")) === "true");
  check(`${tag}: open – nothing covered (${(await overlaps(j)).join(", ")})`, (await overlaps(j)).length === 0);
  // The Beet circle sticks up out of the tab bar (its ring even more) – the card must never cover it: pushed a bit
  // lower, the card still has to go behind the circle.
  const beetOnTop = await j.evaluate(() => {
    const card = document.querySelector("[data-sheet-card]");
    const beet = document.querySelector('nav[aria-label="Hauptmenü"] a[aria-label="Beet"]');
    card.style.translate = "0 12px";
    const r = beet.getBoundingClientRect();
    const hit = beet.contains(document.elementFromPoint(r.left + r.width / 2, r.top + 4));
    card.style.translate = "";
    return hit;
  });
  check(`${tag}: the Beet circle stays in front of the open card`, beetOnTop);
  check(`${tag}: week and subtitle fade out`, (await j.locator("[data-sheet-above]").evaluate((el) => getComputedStyle(el).opacity)) === "0");
  const details = j.locator("[data-sheet-details]");
  check(
    `${tag}: details – Treffpunkt, Mitnehmen, von Sam, Route, Verschieben, Absagen`,
    (await details.getByText("Stift, Handy-Akku, warme Jacke").isVisible()) &&
      (await details.getByText("„ich hab schon den ersten reim!“").isVisible()) &&
      (await details.getByText("VON SAM", { exact: true }).isVisible()) &&
      (await details.getByRole("link", { name: "Route", exact: true }).getAttribute("href"))?.includes("Alter+Markt") &&
      (await details.getByRole("link", { name: "Verschieben" }).getAttribute("href")) === `/plan?reschedule=${date.id}` &&
      (await details.getByRole("button", { name: "Absagen" }).isVisible()),
  );
  if (viewport.width === 390) await j.screenshot({ path: `${OUT}m25-02-offen-sanft.png` });

  // Tap the head → closed, happy again
  await head(j).click();
  await settle(j);
  check(`${tag}: a tap on the head closes it, the flower is happy again`, JSON.stringify(await state(j)) === JSON.stringify({ z: "zu", tempo: "sanft", mood: "froh" }));

  // Pulled up slowly past 35 % → open, sanft; pulled down → closed
  const zu = await head(j).boundingBox();
  await drag(j, { to: zu.y + 30 - 230, ms: 900, steps: 30 });
  await settle(j);
  check(`${tag}: pulled up slowly → open, sanft (${JSON.stringify(await state(j))})`, (await state(j)).z === "mitte" && (await state(j)).tempo === "sanft");
  const open = await head(j).boundingBox();
  await drag(j, { to: open.y + 30 + 260, ms: 900, steps: 30 });
  await settle(j);
  check(`${tag}: pulled down → closed`, (await state(j)).z === "zu");

  // Only a little → back
  await drag(j, { to: zu.y + 30 - 60, ms: 600, steps: 20 });
  await settle(j);
  check(`${tag}: pulled up a little → springs back`, (await state(j)).z === "zu");

  // A flick → schubs: kicked away, motion lines
  await drag(j, { to: zu.y + 30 - 260, ms: 120, steps: 4 });
  await j.waitForTimeout(120);
  const lines = await j.locator(".animate-fade-out").count();
  await settle(j);
  check(`${tag}: a flick kicks the flower (${JSON.stringify(await state(j))}, ${lines} lines)`, JSON.stringify(await state(j)) === JSON.stringify({ z: "mitte", tempo: "schubs", mood: "autsch" }) && lines === 3);
  check(`${tag}: kicked – nothing covered (${(await overlaps(j)).join(", ")})`, (await overlaps(j)).length === 0);
  if (viewport.width === 390) await j.screenshot({ path: `${OUT}m25-03-offen-schubs.png` });

  // Pulled on up → voll: the card covers the screen, its handle is the header's step bar, the flower is gone
  const mid = await head(j).boundingBox();
  await drag(j, { to: 12, ms: 900, steps: 30 });
  await settle(j, 1300);
  const full = await j.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const card = r(document.querySelector("[data-sheet-card]"));
    const handle = r(document.querySelector("[data-sheet-handle]"));
    const center = document.querySelector("[data-header-center]");
    const bar = r(center.firstElementChild ?? center);
    const flower = r(document.querySelector("[data-sheet-flower]"));
    const scroller = document.querySelector("[data-sheet-details]").parentElement;
    const cancel = [...document.querySelectorAll("[data-sheet-details] button")].find((b) => b.textContent.trim() === "Absagen");
    const nav = r(document.querySelector('nav[aria-label="Hauptmenü"]'));
    return {
      cardTop: Math.round(card.top),
      handle: [Math.round(handle.left + handle.width / 2 - (bar.left + bar.width / 2)), Math.round(handle.top + handle.height / 2 - (bar.top + bar.height / 2)), Math.round(handle.width - bar.width)],
      flowerGone: flower.bottom < 0,
      fits: scroller.scrollHeight <= scroller.clientHeight + 1,
      cancelVisible: !!cancel && r(cancel).bottom <= nav.top,
    };
  });
  check(`${tag}: pulled on up → voll (${(await state(j)).z})`, (await state(j)).z === "voll" && (await head(j).getAttribute("aria-label")) === "Weniger Details");
  check(`${tag}: voll – the card covers the screen, the handle sits on the step bar (${JSON.stringify(full)})`, full.cardTop <= 0 && full.handle.every((d) => Math.abs(d) <= 1));
  check(`${tag}: voll – the flower has flown off the top`, full.flowerGone);
  check(`${tag}: voll – everything there without scrolling, Absagen above the tab bar`, (viewport.height < 800 || full.fits) && full.cancelVisible);
  check(`${tag}: voll – name and avatars stay on top`, await j.getByRole("link", { name: "Zweisamen – zum Start" }).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.left + 4, r.top + r.height / 2));
  }));
  if (viewport.width === 390) await j.screenshot({ path: `${OUT}m25-04-voll.png` });

  // Down a bit → back to mitte, the flower flies back in and lands next to the headline
  const fullHead = await head(j).boundingBox();
  await drag(j, { to: fullHead.y + 30 + (mid.y - fullHead.y), ms: 900, steps: 30 });
  await j.waitForTimeout(300);
  const landing = await j.locator("[data-sheet-flower]").boundingBox();
  await settle(j, 1300);
  const landed = await j.locator("[data-sheet-flower]").boundingBox();
  check(`${tag}: down from voll → mitte, the flower comes back down (${Math.round(landing.y)} → ${Math.round(landed.y)})`, (await state(j)).z === "mitte" && landed.y > -40 && landed.y + landed.height > 0);
  check(`${tag}: back at mitte – nothing covered (${(await overlaps(j)).join(", ")})`, (await overlaps(j)).length === 0);

  // voll again, a tap on the head → mitte
  await drag(j, { to: 12, ms: 600, steps: 20 });
  await settle(j, 1300);
  await head(j).click();
  await settle(j, 1300);
  check(`${tag}: at voll a tap on the head goes back to mitte`, (await state(j)).z === "mitte");

  // Back gesture closes it and stays on the Beet
  await j.goBack();
  await settle(j);
  check(`${tag}: back closes the card and stays on the Beet (${j.url()})`, (await state(j)).z === "zu" && j.url() === `${BASE}/plan`);
  await j.context().close();
}

// Reduced motion: no kick, no rotation, no lines
const calm = await pageFor({ width: 390, height: 844 }, { reducedMotion: "reduce" });
const calmHead = await head(calm).boundingBox();
await drag(calm, { to: calmHead.y + 30 - 260, ms: 120, steps: 4 });
await calm.waitForTimeout(100);
const calmLines = await calm.locator(".animate-fade-out").count();
await settle(calm, 400);
const turned = await calm.locator("[data-sheet-flower]").evaluate((el) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return Math.abs(m.b) > 0.001;
});
check(`reduced motion: opens without rotation or lines (${calmLines} lines, rotated ${turned})`, (await state(calm)).z === "mitte" && !turned && calmLines === 0);
await calm.context().close();

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
