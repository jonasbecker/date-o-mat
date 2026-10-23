// M29: test dates for the Archiv (Einstellungen → Mehr → Testdates) – on: past dates with reviews, photos and a
// checklist plus a round that fell through; the Beet and the app icon do not notice; off: all of it is gone, the real
// dates stay.
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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
const j = await ctx.newPage();
j.on("pageerror", (e) => console.log("PAGEERROR", e.message));

const beet = async () => {
  await j.goto(`${BASE}/plan`);
  const headline = j.locator("main h2").filter({ visible: true }).first();
  await headline.waitFor({ timeout: 20000 });
  await j.locator("[data-app-badge]").waitFor({ state: "attached", timeout: 10000 });
  await j.waitForTimeout(600);
  return { headline: (await headline.innerText()).replace(/\s+/g, " "), badge: await j.locator("[data-app-badge]").getAttribute("data-app-badge") };
};
const before = await beet();
const { rows: [{ n: realRounds }] } = await db.query("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1", [couple.id]);

// Switched on in the settings
await j.goto(`${BASE}/settings?t=mehr`);
await j.getByRole("link", { name: /Testdates/ }).click();
await j.getByText("🧪 Testdates im Archiv").waitFor({ timeout: 15000 });
await j.screenshot({ path: `${OUT}m29-01-schalter.png` });
await j.getByRole("checkbox").check();
await j.getByRole("link", { name: "Zum Archiv ›" }).waitFor({ timeout: 15000 });
await j.waitForTimeout(500);
const count = async (sql) => (await db.query(sql, [couple.id])).rows[0].n;
const demo = {
  rounds: await count("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1 AND demo"),
  skipped: await count("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1 AND demo AND status = 'skipped'"),
  dates: await count("SELECT count(*)::int AS n FROM date_plans d JOIN cycles c ON c.id = d.cycle_id WHERE d.couple_id = $1 AND c.demo AND d.status = 'done'"),
  reviews: await count("SELECT count(*)::int AS n FROM date_reviews r JOIN date_plans d ON d.id = r.date_id WHERE d.couple_id = $1"),
  photos: await count("SELECT count(*)::int AS n FROM date_photos WHERE couple_id = $1"),
  tasks: await count("SELECT count(*)::int AS n FROM date_tasks t JOIN date_plans d ON d.id = t.date_id WHERE d.couple_id = $1"),
  negative: await count("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1 AND demo AND seq >= 0"),
};
check(`on: 7 dates in 8 past rounds, one fell through, with reviews, photos and a checklist (${JSON.stringify(demo)})`, demo.rounds === 8 && demo.skipped === 1 && demo.dates === 7 && demo.reviews >= 8 && demo.photos >= 5 && demo.tasks >= 3 && demo.negative === 0);

// The Archiv shows them
await j.getByRole("link", { name: "Zum Archiv ›" }).click();
await j.waitForURL(`${BASE}/dates`);
await j.getByText("Pizza backen und Filmabend").first().waitFor({ timeout: 15000 });
await j.screenshot({ path: `${OUT}m29-02-archiv.png` });
check("the Archiv shows the newest test date", await j.getByText("Pizza backen und Filmabend").first().isVisible());
await j.goto(`${BASE}/dates?ansicht=raster`);
await j.waitForTimeout(800);
await j.screenshot({ path: `${OUT}m29-03-raster.png` });

// A test date's page: both reviews, the photos (drawn), the checklist
const { rows: [hike] } = await db.query("SELECT id FROM date_plans WHERE couple_id = $1 AND title = 'Wanderung im Siebengebirge'", [couple.id]);
await j.goto(`${BASE}/dates/${hike.id}`);
await j.getByText("Oben war die Aussicht der Hammer.").first().waitFor({ timeout: 15000 });
await j.getByRole("tab", { name: /Fotos/ }).or(j.getByRole("button", { name: /Fotos/ })).first().click();
const photos = j.locator('img[src*="/api/photos/"]').filter({ visible: true });
await photos.first().waitFor({ timeout: 10000 });
await j.waitForTimeout(800);
const loaded = await photos.evaluateAll((imgs) => imgs.map((img) => img.complete && img.naturalWidth > 0));
check(`a test date's page: the reviews, and its drawn photos under Fotos (${loaded.length}, loaded ${loaded.filter(Boolean).length})`, loaded.length === 3 && loaded.every(Boolean));
await j.screenshot({ path: `${OUT}m29-04-date.png` });

// The Beet and the app icon do not notice them
const during = await beet();
check(`the Beet stays as it was (${before.headline} → ${during.headline}), the app icon too (${before.badge} → ${during.badge})`, during.headline === before.headline && during.badge === before.badge);
const { rows: [{ n: rounds }] } = await db.query("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1 AND NOT demo", [couple.id]);
check(`no real round was added or moved by them (${realRounds} → ${rounds})`, rounds === realRounds);

// Off: everything gone, the real rounds stay
await j.goto(`${BASE}/settings?t=testdaten`);
await j.getByRole("checkbox").uncheck();
await j.getByRole("link", { name: "Zum Archiv ›" }).waitFor({ state: "detached", timeout: 15000 });
await j.waitForTimeout(500);
const left = {
  rounds: await count("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1 AND demo"),
  dates: await count("SELECT count(*)::int AS n FROM date_plans WHERE couple_id = $1"),
  photos: await count("SELECT count(*)::int AS n FROM date_photos WHERE couple_id = $1"),
  real: await count("SELECT count(*)::int AS n FROM cycles WHERE couple_id = $1 AND NOT demo"),
};
check(`off: all test data gone, the real rounds stay (${JSON.stringify(left)})`, left.rounds === 0 && left.dates === 0 && left.photos === 0 && left.real === realRounds);

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
