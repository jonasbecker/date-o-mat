// M10: Köln ideas + "Überrasch uns".
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
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
const google = await startMock(4010);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("TRUNCATE users, couples, sessions, ideas CASCADE");
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

// 1) Köln tab: list, filters, save
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/ideas/koeln`);
await j.getByRole("heading", { name: "Köln-Ideen" }).waitFor({ timeout: 15000 });
const all = await j.locator("article").count();
check(`all Köln ideas listed (${all})`, all >= 40);
await j.getByRole("button", { name: "Gratis" }).click();
await j.getByRole("button", { name: "🌳 Draußen" }).click();
const free = await j.locator("article").count();
check(`filter gratis + draußen (${free})`, free > 3 && free < all && (await j.locator("article").filter({ hasText: "~" }).count()) === 0);
await j.screenshot({ path: `${OUT}m10-01-koeln.png`, fullPage: false });
await j.getByRole("button", { name: "Jedes Budget" }).click();
const picnic = j.locator("article", { hasText: "Picknick im Rheinpark" });
await picnic.getByRole("button", { name: "Auf die Wunschliste" }).click();
await picnic.getByText("Auf der Wunschliste").waitFor({ timeout: 10000 });
const { rows: saved } = await db.query("SELECT title, source, external_ref, cost_eur FROM ideas WHERE source = 'curated'");
check(`saved with source curated (${JSON.stringify(saved[0])})`, saved.length === 1 && saved[0].external_ref === "rheinpark-picknick");
await picnic.getByText("Auf der Wunschliste").isVisible();

// 2) Überrasch uns on the wishlist page
await j.goto(`${BASE}/ideas`);
await j.getByRole("button", { name: "🎲 Überrasch uns" }).click();
await j.getByText("Kurbel dreht sich").waitFor({ timeout: 5000 }).then(() => check("draw animation", true), () => check("draw animation", false));
await j.getByRole("button", { name: "Damit planen" }).waitFor({ timeout: 10000 });
await j.screenshot({ path: `${OUT}m10-02-surprise.png` });
const titles = new Set();
for (let i = 0; i < 6; i++) {
  titles.add(await j.locator("dialog[open] h3").innerText());
  await j.getByRole("button", { name: "Nochmal ziehen" }).click();
  await j.getByRole("button", { name: "Damit planen" }).waitFor({ timeout: 10000 });
}
check(`six draws, no immediate repeats (${titles.size} different)`, titles.size === 6);

// 3) Draw until a Köln idea, then "Damit planen" → plan page with it preselected
let label = "";
for (let i = 0; i < 20 && !/köln-tipp/i.test(label); i++) {
  await j.getByRole("button", { name: "Nochmal ziehen" }).click();
  await j.getByRole("button", { name: "Damit planen" }).waitFor({ timeout: 10000 });
  label = await j.locator("dialog[open] p.uppercase").innerText();
}
const curatedTitle = await j.locator("dialog[open] h3").innerText();
check(`a Köln tip came up (${curatedTitle})`, /köln-tipp/i.test(label));
await j.getByRole("button", { name: "Damit planen" }).click();
await j.waitForURL(/\/plan\?idea=/, { timeout: 15000 });
await j.getByRole("button", { name: new RegExp(curatedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().waitFor({ timeout: 20000 });
const pressed = await j.getByRole("button", { name: new RegExp(curatedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first().getAttribute("aria-pressed");
check(`plan page preselects "${curatedTitle}" (${pressed})`, pressed === "true");
const { rows: [onList] } = await db.query("SELECT count(*)::int AS c FROM ideas WHERE title = $1", [curatedTitle]);
check("it was put on the wishlist first", onList.c === 1);
await j.screenshot({ path: `${OUT}m10-03-plan.png` });

// 4) Home: button next to "Date planen", dark mode tabs
await j.goto(`${BASE}/`);
await j.getByText("Hey Jonas!").waitFor({ timeout: 15000 });
check("home stays focused: no extra Überrasch-uns button", (await j.getByRole("button", { name: "🎲 Überrasch uns" }).count()) === 0);
await j.goto(`${BASE}/plan`);
await j.getByRole("tab", { name: "🎲 Zufall" }).click();
await j.getByRole("button", { name: "🎲 Überrasch uns" }).click();
await j.getByRole("button", { name: "Nehmen" }).waitFor({ timeout: 10000 });
const drawn = await j.locator("dialog[open] h3").innerText();
await j.getByRole("button", { name: "Nehmen" }).click();
await j.locator("p", { hasText: "Ausgewählt" }).getByText(drawn).waitFor({ timeout: 10000 }).catch(() => {});
await j.screenshot({ path: `${OUT}m10-06-plan-zufall.png` });
check(`plan page: Zufall tab picks "${drawn}" without leaving the page`, (await j.locator("p", { hasText: "Ausgewählt" }).innerText()).includes(drawn) && j.url().endsWith("/plan"));
await j.screenshot({ path: `${OUT}m10-05-home.png` });
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/ideas/koeln`);
await jd.getByRole("heading", { name: "Köln-Ideen" }).waitFor({ timeout: 15000 });
await jd.screenshot({ path: `${OUT}m10-04-koeln-dark.png` });

await browser.close();
google.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
