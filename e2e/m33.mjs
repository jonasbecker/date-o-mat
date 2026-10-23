// M33: the Archiv "unser beet." (docs/design/garten/archiv/) at 390 × 844 and 360 × 740 – the stem (month marks, the
// bud, leaves left and right, a wilted one) and the grid by month, the view remembered; a long title, a leaf without a
// photo (the idea's banner), ten photos, a month with one leaf; a leaf's page (swipe between photos, the small ones,
// both "nochmal?" and notes, no tab bar), the wilted page (reason, back on the shelf, remove with a question) – and once
// through: a date ends → "wie war's?" opens → photo, answer, note → the leaf on the stem → its page.
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { resetDb } from "./db.mjs";
import { layoutAudit } from "./layout-audit.mjs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions, ideas");
const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
async function makeUser(name, email, color) {
  const { rows } = await db.query("INSERT INTO users (google_sub, email, name, couple_id, color, onboarded_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id", [`sub-${email}`, email, name, couple.id, color]);
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id) VALUES ($1, $2)", [couple.id, jonas.id]);

// Past rounds, one week each, oldest first; a date in each – or none (fell through).
const now = DateTime.now().setZone("Europe/Berlin");
let seq = 0;
async function round(weeksAgo, status, planner) {
  const start = now.minus({ weeks: weeksAgo }).startOf("week");
  const { rows: [c] } = await db.query(
    "INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status, closed_at) VALUES ($1, $2, $3, $4, $4, 'alternating', $5, $6, $4) RETURNING id, starts_at",
    [couple.id, ++seq, start.toJSDate(), start.plus({ weeks: 1 }).toJSDate(), planner.id, status],
  );
  return c;
}
async function date(c, title, { status = "done", photos = 0, again = [], ideaMotif = null, at = null, by = jonas } = {}) {
  const startsAt = at ?? DateTime.fromJSDate(c.starts_at).setZone("Europe/Berlin").plus({ days: 4 }).set({ hour: 19 });
  let ideaId = null;
  if (ideaMotif) ({ rows: [{ id: ideaId }] } = await db.query("INSERT INTO ideas (couple_id, title, size, motif, created_by_id, archived_at) VALUES ($1, $2, 'small', $3, $4, now()) RETURNING id", [couple.id, title, ideaMotif, by.id]));
  const { rows: [d] } = await db.query(
    `INSERT INTO date_plans (couple_id, cycle_id, idea_id, title, size, location, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status, estimated_cost_eur)
     VALUES ($1, $2, $3, $4, 'small', 'Rheinauhafen', $5, $6, $7, $7, $8, 'synced', 6) RETURNING id`,
    [couple.id, c.id, ideaId, title, startsAt.toJSDate(), startsAt.plus({ hours: 2 }).toJSDate(), by.id, status],
  );
  for (let p = 0; p < photos; p++) {
    await db.query("INSERT INTO date_photos (couple_id, date_id, uploaded_by_id, full_path, thumb_path, width, height, bytes, created_at) VALUES ($1, $2, $3, $4, $4, 1200, 900, 1000, now() + make_interval(secs => $5))", [couple.id, d.id, by.id, `demo/${p + 3}.svg`, p]);
  }
  for (const [who, a, note] of again) await db.query("INSERT INTO date_reviews (date_id, user_id, again, note) VALUES ($1, $2, $3, $4)", [d.id, who.id, a, note ?? null]);
  return d;
}
const LONG = "Sonnenuntergang an den Kranhäusern mit Picknickdecke, Kerzen, Musik und viel zu vielen Snacks für zwei";
const r1 = await round(9, "done", jonas);
await date(r1, "Picknick auf der Rheinwiese", { photos: 2, again: [[jonas, "yes", "Die Wespen waren egal."], [sam, "yes", "nochmal im Juni!"]] });
const r2 = await round(6, "done", sam); // alone in its month (around six weeks back)
const kino = await date(r2, "Sneak Preview im Kino", { photos: 0, ideaMotif: "kino", again: [[jonas, "no"], [sam, "maybe"]], by: sam });
const r3 = await round(3, "skipped", sam);
await date(r3, "Bouldern im Kletterwerk", { status: "cancelled", ideaMotif: "bouldern", by: sam });
const r4 = await round(2, "done", jonas);
const ten = await date(r4, LONG, { photos: 10, again: [[jonas, "yes", "Bester Abend."], [sam, "yes", "JA."]] });
const r5 = await round(1, "skipped", jonas); // a round with no date at all
await db.query("SELECT 1", []);

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

for (const [width, height] of [
  [390, 844],
  [360, 740],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const j = await ctx.newPage();
  j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  const size = `${width}×${height}`;

  // The stem
  await j.goto(`${BASE}/dates`);
  await j.getByRole("heading", { name: "unser beet." }).waitFor({ timeout: 20000 });
  await j.locator("[data-stem]").waitFor({ timeout: 10000 });
  await j.waitForTimeout(600);
  const stem = await j.evaluate(() => ({
    leaves: [...document.querySelectorAll("[data-stem] [data-leaf]")].map((l) => [l.getAttribute("data-leaf"), Number(l.getAttribute("data-leaf-nr"))]),
    months: [...document.querySelectorAll("[data-stem] [data-month]")].map((m) => m.textContent),
    again: [...document.querySelectorAll("main span")].find((s) => /× nochmal/.test(s.textContent))?.textContent,
    header: document.querySelector("header")?.textContent,
  }));
  check(`${size} stem: newest first, Nº from the oldest, two wilted leaves (${JSON.stringify(stem.leaves)})`, JSON.stringify(stem.leaves) === JSON.stringify([["wilt", 5], ["date", 4], ["wilt", 3], ["date", 2], ["date", 1]]));
  check(`${size} month marks (${stem.months.join(", ")}), „♥ 2× nochmal“ (${stem.again}), „5 Blätter · seit …“`, stem.months.length >= 2 && stem.again === "♥ 2× nochmal" && /5 Blätter · seit /.test(stem.header ?? ""));
  const { issues } = await layoutAudit(j);
  check(`${size} stem: nothing overlaps or is cut off${issues.length ? `: ${issues.join("; ")}` : ""}`, issues.length === 0);
  await j.screenshot({ path: `${OUT}m33-${width}-stiel.png` });
  const long = j.locator("[data-stem] [data-leaf]").filter({ hasText: "Sonnenuntergang" });
  const longTitle = await long.locator("span.line-clamp-3").evaluate((el) => ({ lines: Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)), cut: el.scrollHeight > el.clientHeight }));
  check(`${size} a long title: at most 3 lines (${JSON.stringify(longTitle)})`, longTitle.lines <= 3);
  check(`${size} ten photos: „1/10“ on the leaf`, (await long.getByText("1/10").count()) === 1);
  check(`${size} no photo: the idea's banner (kino)`, (await j.locator("[data-stem] [data-leaf]").filter({ hasText: "Sneak Preview" }).locator('[data-banner="kino"]').count()) === 1);
  await j.locator("[data-stem]").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await j.waitForTimeout(300);
  await j.screenshot({ path: `${OUT}m33-${width}-stiel-unten.png` });

  // The grid, and the view comes back
  await j.getByRole("button", { name: "Raster" }).click();
  await j.locator("[data-grid]").waitFor({ timeout: 5000 });
  const groups = await j.locator("[data-grid] section").evaluateAll((s) => s.map((x) => x.querySelector("h2").textContent));
  check(`${size} grid by month, a month with one leaf says „1 Blatt“ (${groups.join(" | ")})`, groups.some((g) => g.endsWith("1 Blatt")) && groups.length >= 2);
  check(`${size} grid: „♥ nochmal“ on both-yes tiles, AUSGEFALLEN on wilted`, (await j.locator("[data-grid]").getByText("♥ nochmal", { exact: true }).count()) === 2 && (await j.locator("[data-grid]").getByText("AUSGEFALLEN").count()) === 2);
  const gridIssues = (await layoutAudit(j)).issues;
  check(`${size} grid: nothing overlaps or is cut off${gridIssues.length ? `: ${gridIssues.join("; ")}` : ""}`, gridIssues.length === 0);
  await j.screenshot({ path: `${OUT}m33-${width}-raster.png` });
  await j.goto(`${BASE}/plan`);
  await j.goto(`${BASE}/dates`);
  await j.locator("[data-grid]").waitFor({ timeout: 10000 });
  check(`${size} the grid is remembered`, (await j.getByRole("button", { name: "Raster" }).getAttribute("aria-pressed")) === "true");
  await j.getByRole("button", { name: "Stiel" }).click();

  // A leaf's page: ten photos – swipe, the small ones, notes, both answers, no tab bar
  await j.goto(`${BASE}/dates/${ten.id}`);
  const detail = j.locator("[data-leaf-detail]");
  await detail.waitFor({ timeout: 15000 });
  await j.waitForTimeout(600);
  check(`${size} leaf: no tab bar`, (await j.locator('nav[aria-label="Hauptmenü"]').count()) === 0);
  check(`${size} leaf: „1 / 10“, ten small photos and „+“`, (await j.locator("[data-photo-count]").innerText()) === "1 / 10" && (await detail.locator('button[aria-label^="Foto "]').count()) === 10);
  const strip = detail.locator("[data-photo-strip]");
  const box = await strip.boundingBox();
  await strip.evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: "instant" }));
  await j.waitForTimeout(400);
  check(`${size} leaf: swiping shows the next photo (${await j.locator("[data-photo-count]").innerText()})`, (await j.locator("[data-photo-count]").innerText()) === "2 / 10");
  await detail.getByRole("button", { name: "Foto 5" }).click();
  await j.waitForTimeout(700);
  check(`${size} leaf: a small photo makes it big (${await j.locator("[data-photo-count]").innerText()})`, (await j.locator("[data-photo-count]").innerText()) === "5 / 10");
  check(`${size} leaf: both said unbedingt, both notes`, (await detail.locator("[data-again]").innerText()).split("unbedingt").length === 3 && (await detail.getByText("Bester Abend.").isVisible()) && (await detail.getByText("JA.", { exact: true }).isVisible()));
  check(`${size} leaf: Nochmal pflanzen + Teilen`, (await detail.getByRole("button", { name: "Nochmal pflanzen" }).isVisible()) && (await detail.getByRole("button", { name: "Teilen" }).isVisible()));
  const leafIssues = (await layoutAudit(j)).issues;
  check(`${size} leaf: nothing overlaps or is cut off${leafIssues.length ? `: ${leafIssues.join("; ")}` : ""}`, leafIssues.length === 0);
  await j.screenshot({ path: `${OUT}m33-${width}-blatt-10.png` });
  void box;

  // A leaf without photos: the idea's banner big
  await j.goto(`${BASE}/dates/${kino.id}`);
  await detail.waitFor({ timeout: 15000 });
  await j.waitForTimeout(500);
  check(`${size} no photo: the banner fills the top, Sam's „vielleicht“ and Jonas' „nö“`, (await detail.locator('[data-banner="kino"]').count()) === 1 && /nö/.test(await detail.locator("[data-again]").innerText()) && /vielleicht/.test(await detail.locator("[data-again]").innerText()));
  await j.screenshot({ path: `${OUT}m33-${width}-blatt-ohne-foto.png` });

  // The wilted leaf
  await j.goto(`${BASE}/dates/runde/${r3.id}`);
  await j.getByRole("heading", { name: "fiel aus." }).waitFor({ timeout: 15000 });
  await j.waitForTimeout(500);
  const planned = await j.locator("[data-wilt] .grid").first().innerText();
  check(`${size} wilted: title, who planned it (${planned.replace(/\s+/g, " ")}), the reasons`, (await j.getByText("Bouldern im Kletterwerk").isVisible()) && (await j.getByRole("radio", { name: "krank" }).isVisible()) && planned.includes("Sam"));
  const wiltIssues = (await layoutAudit(j)).issues;
  check(`${size} wilted: nothing overlaps or is cut off${wiltIssues.length ? `: ${wiltIssues.join("; ")}` : ""}`, wiltIssues.length === 0);
  await j.screenshot({ path: `${OUT}m33-${width}-welk.png` });
  await ctx.close();
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
const j = await ctx.newPage();
j.on("pageerror", (e) => console.log("PAGEERROR", e.message));

// Wilted: a reason and a note are kept; back on the shelf; off the stem after a question
await j.goto(`${BASE}/dates/runde/${r3.id}`);
await j.getByRole("radio", { name: "krank" }).waitFor({ timeout: 15000 });
await j.waitForTimeout(600);
await j.getByRole("radio", { name: "krank" }).click();
await j.getByRole("button", { name: "+ notiz" }).click();
await j.getByLabel("Notiz").fill("Erkältung");
await j.getByLabel("Notiz").blur();
await j.waitForTimeout(800);
const { rows: [wilt] } = await db.query("SELECT wilt_reason, wilt_note FROM cycles WHERE id = $1", [r3.id]);
check(`wilted: reason and note kept (${JSON.stringify(wilt)})`, wilt.wilt_reason === "sick" && wilt.wilt_note === "Erkältung");
await j.getByRole("button", { name: "Zurück ins Regal legen" }).click();
await j.waitForURL(/\/ideas\?ansicht=alle&idee=/, { timeout: 15000 });
const { rows: [boulder] } = await db.query("SELECT archived_at FROM ideas WHERE title = 'Bouldern im Kletterwerk'");
check("„Zurück ins Regal legen“: the idea is on the wishlist again", boulder.archived_at === null);
await j.goto(`${BASE}/dates/runde/${r5.id}`);
await j.getByRole("button", { name: "Blatt entfernen" }).click();
await j.getByRole("button", { name: "Ja, entfernen" }).click();
await j.waitForURL(`${BASE}/dates`, { timeout: 15000 });
await j.locator("[data-stem]").waitFor({ timeout: 10000 });
check("„Blatt entfernen“ asks first, then the leaf is off the stem", (await j.locator('[data-stem] [data-leaf="wilt"]').count()) === 1);

// Once through: a date ends → "wie war's?" opens by itself → photo, answer, note → the leaf on the stem → its page
// The date lives in the round it happens in – the one the app made for now.
const { rows: [r6] } = await db.query("SELECT id, starts_at FROM cycles WHERE couple_id = $1 AND starts_at <= now() AND ends_at > now() ORDER BY seq DESC LIMIT 1", [couple.id]);
const ended = now.minus({ hours: 3 });
const fresh = await date(r6, "Crêpes & ABBA-Karaoke", { at: ended, ideaMotif: "crepes", by: sam });
await j.goto(`${BASE}/plan`);
await j.waitForURL(`${BASE}/dates/${fresh.id}/wie-wars`, { timeout: 20000 });
check("after the date, „wie war's?“ opens by itself", await j.getByRole("heading", { name: "wie war’s?" }).isVisible());
await j.screenshot({ path: `${OUT}m33-390-wiewars-leer.png` });
const save = j.getByRole("button", { name: "Blatt anheften" });
check("„Blatt anheften“ is greyed out until there is an answer", await save.isDisabled());
// A photo (a real JPEG made by the browser)
const jpeg = await j.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1200;
  const g = c.getContext("2d");
  g.fillStyle = "#F2A07B";
  g.fillRect(0, 0, 1600, 1200);
  g.fillStyle = "#3B4E7A";
  g.fillRect(0, 700, 1600, 500);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
  return [...new Uint8Array(await blob.arrayBuffer())];
});
await j.locator("[data-photo-input]").setInputFiles({ name: "abend.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
await j.locator("[data-photo-row] img").first().waitFor({ timeout: 20000 }).catch(() => {});
const uploaded = (await db.query("SELECT count(*)::int AS n FROM date_photos WHERE date_id = $1", [fresh.id])).rows[0].n;
const storageOff = await j.getByText("Fotos sind auf dem Server noch nicht eingerichtet").count();
check(`a photo onto the leaf (${uploaded} stored${storageOff ? ", no photo storage here" : ""})`, uploaded === 1 || storageOff > 0);
for (const [answer, quip] of [
  ["nö", "okay. kompost. passiert den besten."],
  ["vielleicht", "solide. 7 von 10 blättern."],
  ["unbedingt", "JAAA! ich blüh gleich mit."],
]) {
  await j.getByRole("radio", { name: answer }).click();
  const said = await j.locator("[data-flower-quip]").innerText();
  check(`„${answer}“: the flower says „${said}“`, said === quip);
  if (answer === "nö") await j.screenshot({ path: `${OUT}m33-390-wiewars-noe.png` });
}
await j.getByLabel("EIN SATZ FÜR SPÄTER").fill("Dancing Queen, zweimal.");
const wwIssues = (await layoutAudit(j)).issues;
check(`„wie war's?“: nothing overlaps or is cut off${wwIssues.length ? `: ${wwIssues.join("; ")}` : ""}`, wwIssues.length === 0);
await j.screenshot({ path: `${OUT}m33-390-wiewars-ja.png` });
await save.click();
await j.waitForURL(`${BASE}/dates/${fresh.id}`, { timeout: 15000 });
await j.locator("[data-leaf-detail]").waitFor({ timeout: 10000 });
check("…saved, the leaf opens with the note", await j.locator("[data-leaf-detail] [data-notes]").getByText("Dancing Queen, zweimal.").isVisible());
await j.goto(`${BASE}/dates`);
await j.locator("[data-stem]").waitFor({ timeout: 10000 });
const top = j.locator("[data-stem] [data-leaf]").first();
check(`the new leaf is on top of the stem (${(await top.innerText()).split("\n")[1]})`, (await top.innerText()).includes("Crêpes & ABBA-Karaoke"));
await top.getByRole("link").click();
await j.waitForURL(`${BASE}/dates/${fresh.id}`, { timeout: 10000 });
check("…and opens its page", await j.locator("[data-leaf-detail]").isVisible());

// 360 × 740 "wie war's?"
{
  const small = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, locale: "de-DE" });
  await small.addCookies([{ name: "dom_session", value: sam.token, url: BASE }]);
  const s = await small.newPage();
  await s.goto(`${BASE}/dates/${fresh.id}/wie-wars`);
  await s.getByRole("radio", { name: "vielleicht" }).waitFor({ timeout: 15000 });
  await s.getByRole("radio", { name: "vielleicht" }).click();
  const smallIssues = (await layoutAudit(s)).issues;
  check(`360 „wie war's?“: nothing overlaps or is cut off; Jonas' answer waits (${await s.getByText(/hat schon geantwortet/).count()})${smallIssues.length ? `: ${smallIssues.join("; ")}` : ""}`, smallIssues.length === 0 && (await s.getByText("Jonas hat schon geantwortet – du siehst es nach dir.").isVisible()));
  await s.screenshot({ path: `${OUT}m33-360-wiewars.png` });
  await small.close();
}

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
