// M20: "Eure Date-Story" – the year to tap through, swipe taste, story push in late December.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { startMock } from "./google-mock.mjs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const ZONE = "Europe/Berlin";
const CRON = { headers: { Authorization: "Bearer test-cron-secret-123456" } };
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
await db.query("TRUNCATE users, couples, sessions, ideas CASCADE");
const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
async function makeUser(name, email, color, accessToken, createdAt) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color, createdAt],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  await db.query(
    `INSERT INTO google_connections (user_id, refresh_token_enc, access_token_enc, access_token_expires_at, busy_calendar_ids)
     VALUES ($1, $2, $3, now() + interval '120 days', '{primary}')`,
    [rows[0].id, encrypt("fake-refresh"), encrypt(accessToken)],
  );
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas", "2025-01-01");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2025-01-02");

// App time: 28 December of this year, 11:00 – the story is ready.
const year = DateTime.now().setZone(ZONE).year;
const appNow = DateTime.fromObject({ year, month: 12, day: 28, hour: 11 }, { zone: ZONE });
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [
  couple.id,
  jonas.id,
  Math.round((appNow.toMillis() - Date.now()) / 60_000),
]);
const { rows: [cycle] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status, closed_at)
   VALUES ($1, 1, $2, $3, $4, 'alternating', $5, 'done', now()) RETURNING id`,
  [couple.id, DateTime.fromObject({ year: year - 1, month: 1, day: 1 }, { zone: ZONE }).toJSDate(), appNow.minus({ days: 1 }).toJSDate(), appNow.minus({ days: 2 }).toJSDate(), jonas.id],
);
async function addDate(title, when, hours, size, cost, ratings) {
  const { rows: [d] } = await db.query(
    `INSERT INTO date_plans (couple_id, cycle_id, title, size, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status, estimated_cost_eur)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'done', 'synced', $8) RETURNING id`,
    [couple.id, cycle.id, title, size, when.toJSDate(), when.plus({ hours }).toJSDate(), jonas.id, cost],
  );
  for (const [userId, rating] of ratings) await db.query("INSERT INTO date_reviews (date_id, user_id, rating) VALUES ($1, $2, $3)", [d.id, userId, rating]);
  return d.id;
}
// The first two Fridays in March of this year.
let fri = DateTime.fromObject({ year, month: 3, day: 1, hour: 19 }, { zone: ZONE });
while (fri.weekday !== 5) fri = fri.plus({ days: 1 });
await addDate("Kino", fri, 2, "small", 24, [[jonas.id, 4], [sam.id, 5]]);
await addDate("Ramen-Abend", fri.plus({ weeks: 1 }), 2, "small", 36, [[jonas.id, 5], [sam.id, 5]]);
await addDate("Ausflug nach Bonn", DateTime.fromObject({ year, month: 7, day: 11, hour: 10 }, { zone: ZONE }), 8, "large", 60, [[jonas.id, 4]]);
await addDate("Letztes Jahr", DateTime.fromObject({ year: year - 1, month: 11, day: 7, hour: 19 }, { zone: ZONE }), 2, "small", 10, []);

// Swipes: Jonas likes food a lot, Sam is pickier; two matches.
async function card(title, theme, status = "open") {
  const { rows: [c] } = await db.query(
    "INSERT INTO deck_cards (couple_id, kind, title, size, theme, dedupe_key, status, matched_at, batch) VALUES ($1, 'idea', $2, 'small', $3, $2, $4, CASE WHEN $4 = 'matched' THEN $5::timestamptz END, 1) RETURNING id",
    [couple.id, title, theme, status, appNow.minus({ days: 30 }).toJSDate()],
  );
  return c.id;
}
for (let i = 0; i < 12; i++) {
  const id = await card(`Karte ${i}`, i < 6 ? "food" : i < 9 ? "nature" : "culture", i < 2 ? "matched" : "open");
  await db.query("INSERT INTO deck_swipes (card_id, user_id, verdict, created_at) VALUES ($1, $2, $3, $4)", [id, jonas.id, i < 10 ? "like" : "nope", appNow.minus({ days: 20 }).toJSDate()]);
  await db.query("INSERT INTO deck_swipes (card_id, user_id, verdict, created_at) VALUES ($1, $2, $3, $4)", [id, sam.id, i < 4 ? "like" : "nope", appNow.minus({ days: 20 }).toJSDate()]);
}

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failures++; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}

// 1) Late December: the story is ready – the start page says so
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/plan`);
const tile = j.getByRole("link", { name: `Eure Date-Story ${year} ist da – tipp rein!` });
await tile.waitFor({ timeout: 15000 });
check("tile for the story on the start page", (await tile.getAttribute("href")) === `/story?year=${year}`);

// 2) Tap through
await tile.click();
const slide = j.locator('[aria-roledescription="Folie"]');
await slide.waitFor({ timeout: 15000 });
await j.waitForTimeout(800);
const texts = [];
for (let i = 0; i < 12; i++) {
  texts.push((await slide.innerText()).replace(/\s+/g, " "));
  if (i === 1) await j.screenshot({ path: `${OUT}m20-01-count.png` });
  if (await j.getByRole("button", { name: "Weiter →" }).isDisabled()) break;
  await j.getByRole("button", { name: "Weiter →" }).click();
}
const has = (re) => texts.some((t) => re.test(t));
check(`intro (${texts[0]})`, has(new RegExp(`Eure Date-Story ${year} Jonas & Sam`, "i")));
check("3 dates this year, 12 hours", has(/Ihr hattet 3 Dates – das sind rund 12 Stunden/));
check("favorite: Ramen-Abend with 5 hearts", has(/Euer Lieblingsdate Ramen-Abend ❤️❤️❤️❤️❤️ \(5\)/));
check("average hearts 4,6 (own rating counts, the partner's only once both rated)", has(/Im Schnitt gab's 4,6 ❤️/));
check("date month März, Freitag", has(/Euer Date-Monat März mit 2 Dates/) && has(/Lieblingstag: Freitag/));
check("money: 120 € total, 40 € per date", has(/120 € im Schnitt 40 € pro Date/));
check("taste: Essen & Trinken first, Jonas swipes right more often", has(/1\. Essen & Trinken/) && has(/Jonas wischt öfter nach rechts \(83 %\)/));
check("outro", has(new RegExp(`Auf ${year + 1}!`)));
check("last year's date is not counted", !has(/Letztes Jahr/));
await j.screenshot({ path: `${OUT}m20-02-taste.png` });

// tap on the left third goes back
const box = await slide.boundingBox();
const before = await j.locator('[aria-roledescription="Folie"]').getAttribute("aria-label");
await j.mouse.click(box.x + 20, box.y + box.height / 2);
check(`tap left goes back (${before} → ${await slide.getAttribute("aria-label")})`, (await slide.getAttribute("aria-label")) !== before);

// 3) Years: last year is there too
check("year switch", await j.getByRole("link", { name: String(year - 1) }).isVisible());
await j.getByRole("link", { name: String(year - 1) }).click();
await j.waitForURL(new RegExp(`year=${year - 1}`));
await slide.waitFor();
await j.waitForTimeout(800);
await j.getByRole("button", { name: "Weiter →" }).click();
check("last year: 1 date", await slide.getByText(/Ihr hattet/).waitFor({ timeout: 5000 }).then(async () => /Ihr hattet\s+1\s+Date/.test(await slide.innerText()), () => false));

// 4) Dates page links to the story; the swipe page shows "Euer Ding"
await j.goto(`${BASE}/dates`);
check("dates page link", (await j.getByRole("link", { name: /Euer Jahr zum Durchtippen/ }).getAttribute("href")) === "/story");
await j.goto(`${BASE}/ideas/entdecken`);
await j.getByText(/Euer Ding: Essen & Trinken/).waitFor({ timeout: 15000 }).then(() => check("swipe page: Euer Ding", true), () => check("swipe page: Euer Ding", false));

// 5) Push "Eure Date-Story ist fertig" once for both
await fetch(`${BASE}/api/cron/tick`, CRON);
await fetch(`${BASE}/api/cron/tick`, CRON);
const { rows: pushes } = await db.query("SELECT user_id, ref_id FROM notification_log WHERE type = 'story'");
check(`story push once each (${pushes.length})`, pushes.length === 2 && pushes.every((p) => p.ref_id === String(year)));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
