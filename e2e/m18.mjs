// M18: monthly budget, real costs after a date, savings pot, month recap, paying from the pot.
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
     VALUES ($1, $2, $3, now() + interval '30 days', '{primary}')`,
    [rows[0].id, encrypt("fake-refresh"), encrypt(accessToken)],
  );
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas", "2026-01-01");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");

// The app clock: the 15th of this month, 12:00 – later the 2nd of next month.
const month = DateTime.now().setZone(ZONE).startOf("month");
const offsetTo = (t) => Math.round((t.toMillis() - Date.now()) / 60_000);
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, offsetTo(month.set({ day: 15, hour: 12 }))]);
await db.query("INSERT INTO ideas (couple_id, title, size, cost_eur, created_by_id, created_at) VALUES ($1, 'Sushi-Abend', 'small', 40, $2, now() - interval '3 days')", [couple.id, jonas.id]);
await db.query("INSERT INTO ideas (couple_id, title, size, cost_eur, created_by_id) VALUES ($1, 'Spaziergang am Rhein', 'small', 0, $2)", [couple.id, jonas.id]);
const { rows: [cycle] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status, closed_at)
   VALUES ($1, 1, $2, $3, $4, 'alternating', $5, 'done', now()) RETURNING id`,
  [couple.id, month.toJSDate(), month.plus({ months: 1 }).toJSDate(), month.plus({ days: 20 }).toJSDate(), jonas.id],
);
async function addDate(title, day, status, estimate) {
  const start = month.set({ day, hour: 19 });
  const { rows } = await db.query(
    `INSERT INTO date_plans (couple_id, cycle_id, title, size, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status, estimated_cost_eur)
     VALUES ($1, $2, $3, 'small', $4, $5, $6, $6, $7, 'synced', $8) RETURNING id`,
    [couple.id, cycle.id, title, start.toJSDate(), start.plus({ hours: 2 }).toJSDate(), jonas.id, status, estimate],
  );
  return rows[0].id;
}
const kino = await addDate("Kino", 10, "done", 30);
await addDate("Bowling", 20, "planned", 20);
await addDate("Abgesagt", 22, "cancelled", 50);

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
const monthName = month.setLocale("de").toFormat("LLLL");
const nextMonthName = month.plus({ months: 1 }).setLocale("de").toFormat("LLLL");

// 1) No budget yet: no bar on the home screen
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/`);
await j.getByText("Hey Jonas!").waitFor({ timeout: 15000 });
check("no budget → no bar", (await j.getByRole("meter").count()) === 0);

// 2) Set 80 € in the settings
await j.goto(`${BASE}/settings`);
await j.getByLabel("Monatsbudget für Dates").waitFor({ timeout: 15000 }).catch(async () => console.log("DEBUG", (await j.locator("main").innerText()).slice(0, 3000)));
await j.getByLabel("Monatsbudget für Dates").fill("80 €");
await j.locator("form", { has: j.getByLabel("Monatsbudget für Dates") }).getByRole("button", { name: "Speichern" }).click();
await j.getByText("Gespeichert ✓").waitFor({ timeout: 10000 });
const { rows: [settings] } = await db.query("SELECT monthly_budget_eur, budget_since_month FROM couple_settings WHERE couple_id = $1", [couple.id]);
check(`budget saved (${JSON.stringify(settings)})`, settings.monthly_budget_eur === 80 && settings.budget_since_month === month.toFormat("yyyy-LL"));
await j.getByLabel("Monatsbudget für Dates").fill("viel");
await j.locator("form", { has: j.getByLabel("Monatsbudget für Dates") }).getByRole("button", { name: "Speichern" }).click();
check("invalid budget is rejected", await j.getByRole("alert").filter({ hasText: "zwischen 1 und 10.000" }).waitFor({ timeout: 5000 }).then(() => true, () => false));

// 3) Home: 30 (Kino, done) + 20 (Bowling, planned) of 80 – the cancelled one does not count
await j.goto(`${BASE}/`);
const bar = j.getByRole("link", { name: new RegExp(`${monthName}: 50 von 80 €`) });
await bar.waitFor({ timeout: 15000 });
check("home bar: 50 von 80 €, noch 30 €", (await bar.innerText()).includes("noch 30 €") && (await bar.innerText()).includes("davon 20 € schon verplant"));
await j.screenshot({ path: `${OUT}m18-01-home.png` });

// 4) Review: the real amount (prefilled with the estimate)
await j.goto(`${BASE}/dates/${kino}`);
const cost = j.getByLabel("Kosten in Euro");
check(`cost prefilled with the estimate (${await cost.inputValue()})`, (await cost.inputValue()) === "30");
await j.waitForTimeout(800); // hydration
await j.locator("label").filter({ has: j.getByLabel("4 Herzen") }).click();
await cost.fill("45");
await j.getByRole("button", { name: "Bewertung abschicken" }).click();
await j.getByText("Meine Bewertung ändern").waitFor({ timeout: 10000 });
check("real amount saved", (await db.query("SELECT actual_cost_eur FROM date_plans WHERE id = $1", [kino])).rows[0].actual_cost_eur === 45);

// 5) Budget page: list with real and planned amounts
await j.goto(`${BASE}/budget`);
await j.getByRole("heading", { name: monthName }).waitFor({ timeout: 15000 });
check("budget page: 65 von 80 €", await j.getByText(`${monthName}: 65 von 80 €`).isVisible());
check("budget page lists Kino 45 € and Bowling 20 €", await j.getByRole("listitem").filter({ hasText: "Kino" }).getByText("45 €").isVisible() && await j.getByRole("listitem").filter({ hasText: "Bowling" }).getByText("20 €").isVisible());
check("cancelled date is not listed", (await j.getByText("Abgesagt").count()) === 0);
await j.screenshot({ path: `${OUT}m18-02-budget.png`, fullPage: true });

// 6) Next month: the tick closes the month – 15 € into the pot, recap for both
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, offsetTo(month.plus({ months: 1 }).set({ day: 2, hour: 10 }))]);
await fetch(`${BASE}/api/cron/tick`, CRON);
await fetch(`${BASE}/api/cron/tick`, CRON);
const { rows: closed } = await db.query("SELECT month, budget_eur, spent_eur, pot_after_eur, dates FROM budget_months WHERE couple_id = $1", [couple.id]);
check(`month closed (${JSON.stringify(closed)})`, closed.length === 1 && closed[0].spent_eur === 65 && closed[0].pot_after_eur === 15 && closed[0].dates === 2);
const { rows: recaps } = await db.query("SELECT user_id, ref_id FROM notification_log WHERE type = 'budget'");
check(`recap once for both (${recaps.length})`, recaps.length === 2 && recaps.every((r) => r.ref_id === month.toFormat("yyyy-LL")));
await j.goto(`${BASE}/`);
const bar2 = j.getByRole("link", { name: new RegExp(`${nextMonthName}: 0 von 80 €`) });
await bar2.waitFor({ timeout: 15000 });
check("new month starts at 0, pot shows 15 €", (await bar2.innerText()).includes("Spartopf: 15 €"));

// 7) Planning: an idea over budget is marked; pay from the pot
await db.query("UPDATE couple_settings SET monthly_budget_eur = 30 WHERE couple_id = $1", [couple.id]);
await j.goto(`${BASE}/plan`);
await j.locator("ol li button").first().waitFor({ timeout: 20000 });
await j.waitForTimeout(800);
await j.getByRole("button", { name: /Sushi-Abend/ }).first().click();
check("idea over budget is marked", await j.getByText("⚠️ über Budget").first().isVisible());
check("hint in the footer", await j.getByText("⚠️ Sprengt euer Budget (noch 30 €)").isVisible());
await j.getByLabel(/Aus dem Spartopf \(15 €\)/).check();
await j.screenshot({ path: `${OUT}m18-03-plan.png` });
await j.getByRole("button", { name: "Date festlegen 🎉" }).click();
await j.waitForURL(`${BASE}/`, { timeout: 15000 });
const { rows: [planned] } = await db.query("SELECT title, from_pot, estimated_cost_eur FROM date_plans WHERE couple_id = $1 AND status = 'planned' ORDER BY created_at DESC LIMIT 1", [couple.id]);
check(`planned from the pot with the estimate (${JSON.stringify(planned)})`, planned.title === "Sushi-Abend" && planned.from_pot === true && planned.estimated_cost_eur === 40);
const bar3 = j.getByRole("link", { name: new RegExp(`${nextMonthName}: 0 von 30 €`) });
await bar3.waitFor({ timeout: 15000 });
check("month budget untouched, pot used up", (await bar3.innerText()).includes("Spartopf: 0 €"));

// 8) Sam sees the same numbers
const s = await pageFor(sam.token);
await s.goto(`${BASE}/budget`);
await s.getByText("🎁 aus dem Spartopf").waitFor({ timeout: 15000 });
check("Sam sees the pot date and the history", await s.getByText(`${monthName} · 2 Dates`).isVisible());

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
