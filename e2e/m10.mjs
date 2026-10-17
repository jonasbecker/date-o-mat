// M10: Köln ideas (swipe deck, "Was anderes" when planning) + "Zufall".
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { startMock } from "./google-mock.mjs";
import { resetDb } from "./db.mjs";

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
const google = await startMock(4010);
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
     VALUES ($1, $2, $3, now() + interval '1 hour', '{primary}')`,
    [rows[0].id, encrypt("fake-refresh"), encrypt(accessToken)],
  );
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas", "2026-01-01");
await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id) VALUES ($1, $2)", [couple.id, jonas.id]);
for (const [title, size, loc] of [["Picknick im Stadtwald", "small", "Stadtwald"], ["Tagesausflug nach Bonn", "large", "Bonn"], ["Kochabend: Ramen selbst machen", "small", null], ["Kletterhalle ausprobieren", "small", "Ehrenfeld"]]) {
  await db.query("INSERT INTO ideas (couple_id, title, size, location, created_by_id) VALUES ($1, $2, $3, $4, $5)", [couple.id, title, size, loc, jonas.id]);
}
let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failures++; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
  if (token) await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}

// 1) The old Köln tab now leads to the swipe deck, which has the Köln ideas as cards
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/ideas/koeln`);
await j.waitForURL(/\/ideas\/entdecken/, { timeout: 15000 });
check("/ideas/koeln redirects to the swipe deck", true);
check("no tabs on the ideas pages any more", (await j.getByRole("navigation", { name: "Ideen" }).count()) === 0 && (await j.getByRole("heading", { name: "Ideen swipen" }).isVisible()));
let koelnCards = 0;
for (let i = 0; i < 20 && koelnCards === 0; i++) {
  await j.waitForTimeout(500);
  koelnCards = (await db.query("SELECT count(*)::int AS c FROM deck_cards WHERE emoji = '📍'")).rows[0].c;
}
check(`Köln ideas come into the deck even without the AI (${koelnCards})`, koelnCards >= 3);
await j.reload();
await j.locator('[aria-roledescription="Karte"]').first().waitFor({ timeout: 15000 });
await j.screenshot({ path: `${OUT}m10-01-koeln.png`, fullPage: false });

// 2) Plan → "Was anderes": Köln ideas with search and the shared filter
await j.goto(`${BASE}/plan?pick=1`);
await j.getByRole("button", { name: "Was anderes" }).click();
const more = j.locator("dialog[open]");
await more.getByRole("heading", { name: "📍 Ideen für Köln" }).waitFor({ timeout: 10000 });
const all = await more.locator("li").count();
check(`all Köln ideas listed (${all})`, all >= 20);
await more.getByRole("searchbox", { name: "Ideen durchsuchen" }).fill("rhein");
const found = await more.locator("li").count();
// The search also looks at the note, which the list does not show.
check(`search narrows the list (${found})`, found > 0 && found < all && (await more.locator("li").allInnerTexts()).some((t) => /rhein/i.test(t)));
await more.getByRole("searchbox", { name: "Ideen durchsuchen" }).fill("");
await j.screenshot({ path: `${OUT}m10-03-plan.png` });
await j.locator("dialog[open]").getByRole("button", { name: "Filter", exact: true }).click();
// The filter sheet opens on top; its choices apply right away.
const filterSheet = j.locator("dialog[open]").last();
await filterSheet.getByRole("button", { name: "🆓 Gratis" }).click();
await filterSheet.getByRole("button", { name: "🌳 Draußen" }).click();
await filterSheet.getByRole("button", { name: "Fertig" }).click();
const freeOut = await more.locator("li").count();
check(`filter gratis + draußen (${freeOut})`, freeOut > 2 && freeOut < all && (await more.locator("li").filter({ hasText: "~" }).count()) === 0 && (await more.locator("li").filter({ hasText: "Drinnen" }).count()) === 0);
await more.getByRole("button", { name: "Filter: 🆓 Gratis · 🌳 Draußen" }).click();
await j.locator("dialog[open]").last().getByRole("button", { name: "Zurücksetzen" }).click();
await j.locator("dialog[open]").last().getByRole("button", { name: "Fertig" }).click();
const picnic = more.locator("li", { hasText: "Picknick im Rheinpark" });
await picnic.getByRole("button", { name: "Nehmen" }).click();
await j.locator("div", { hasText: "Ihr macht" }).getByText("Picknick im Rheinpark", { exact: true }).first().waitFor({ timeout: 10000 });
const { rows: saved } = await db.query("SELECT title, source, external_ref FROM ideas WHERE source = 'curated'");
check(`"Nehmen" saves it (curated) and selects it (${JSON.stringify(saved[0])})`, saved.length === 1 && saved[0].external_ref === "rheinpark-picknick");

// 3) Plan → "Zufall": draws without repeats, Köln tips too, "Nehmen" selects
await j.goto(`${BASE}/plan?pick=1`);
await j.getByRole("button", { name: "Zufall" }).click();
await j.getByText("Kurbel dreht sich").waitFor({ timeout: 5000 }).then(() => check("draw animation", true), () => check("draw animation", false));
await j.locator("dialog[open]").getByRole("button", { name: "Nehmen" }).waitFor({ timeout: 10000 });
await j.screenshot({ path: `${OUT}m10-02-surprise.png` });
const titles = new Set();
for (let i = 0; i < 6; i++) {
  titles.add(await j.locator("dialog[open] h3").innerText());
  await j.getByRole("button", { name: "Nochmal ziehen" }).click();
  await j.locator("dialog[open]").getByRole("button", { name: "Nehmen" }).waitFor({ timeout: 10000 });
}
check(`six draws, no immediate repeats (${titles.size} different)`, titles.size === 6);
let label = "";
for (let i = 0; i < 20 && !/köln-tipp/i.test(label); i++) {
  await j.getByRole("button", { name: "Nochmal ziehen" }).click();
  await j.locator("dialog[open]").getByRole("button", { name: "Nehmen" }).waitFor({ timeout: 10000 });
  label = await j.locator("dialog[open] p.uppercase").innerText();
}
const drawn = await j.locator("dialog[open] h3").innerText();
check(`a Köln tip came up (${drawn})`, /köln-tipp/i.test(label));
await j.locator("dialog[open]").getByRole("button", { name: "Nehmen" }).click();
const chosen = j.locator("div", { hasText: "Ihr macht" }).getByText(drawn, { exact: true }).first();
await chosen.waitFor({ timeout: 10000 }).catch(() => {});
await j.screenshot({ path: `${OUT}m10-06-plan-zufall.png` });
check(`Zufall picks "${drawn}" and goes on to the times`, (await chosen.isVisible()) && /\/plan(\?pick=1)?$/.test(j.url()));
const { rows: [onList] } = await db.query("SELECT count(*)::int AS c FROM ideas WHERE title = $1", [drawn]);
check("it was put on the wishlist first", onList.c === 1);

// 4) Home stays focused; dark mode
await j.goto(`${BASE}/dates`);
await j.getByRole("heading", { name: "Eure Dates" }).waitFor({ timeout: 15000 });
check("Dates stays focused: no Zufall button", (await j.getByRole("button", { name: /Überrasch uns|Zufall/ }).count()) === 0);
await j.screenshot({ path: `${OUT}m10-05-home.png` });
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/plan?pick=1`);
await jd.getByRole("button", { name: "Was anderes" }).click();
await jd.locator("dialog[open]").getByRole("heading", { name: "📍 Ideen für Köln" }).waitFor({ timeout: 15000 });
await jd.waitForTimeout(400);
await jd.screenshot({ path: `${OUT}m10-04-koeln-dark.png` });

await browser.close();
google.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
