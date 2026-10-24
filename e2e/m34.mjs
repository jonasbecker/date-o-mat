// M34: the dev tools' test date (Einstellungen → Ihr zwei & Konto, ENABLE_DEV_TOOLS=1) – no date, my proposal, the
// partner's proposal, a date both agreed to; the Beet follows each, nothing goes to Google, "Kein Date" takes it out
// again and cancels a real upcoming date.
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
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset()]);
await db.query("INSERT INTO ideas (couple_id, title, size, created_by_id) VALUES ($1, 'Ramen in Ehrenfeld', 'small', $2)", [couple.id, jonas.id]);

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

const headline = async () => {
  await j.goto(`${BASE}/plan`);
  const h = j.locator("main h2").filter({ visible: true }).first();
  await h.waitFor({ timeout: 20000 });
  return (await h.innerText()).replace(/\s+/g, " ");
};
const dates = async () => (await db.query("SELECT title, status, proposed_by_id, google_event_id, sync_status FROM date_plans WHERE couple_id = $1 AND status <> 'cancelled'", [couple.id])).rows;
const choose = async (name, state) => {
  await j.goto(`${BASE}/settings?t=konto`);
  await j.getByRole("radio", { name }).click();
  await j.locator(`[data-dev-date="${state}"]`).waitFor({ timeout: 15000 });
  await j.getByRole("radio", { name, checked: true }).waitFor({ timeout: 15000 });
  await j.waitForTimeout(500);
};

const start = await headline();
check(`without a date it is my turn (${start})`, start === "du bist dran.");
await j.goto(`${BASE}/settings?t=konto`);
await j.getByRole("radiogroup", { name: "Test-Date" }).waitFor({ timeout: 15000 });
check("the card shows “Kein Date” as chosen", await j.getByRole("radio", { name: "Kein Date", checked: true }).isVisible());
await j.getByRole("radiogroup", { name: "Test-Date" }).scrollIntoViewIfNeeded();
await j.screenshot({ path: `${OUT}m34-01-karte.png` });

await choose("Ich schlage vor", "mine");
let rows = await dates();
check(`mine: one planned date from the list, proposed by me, never sent to Google (${JSON.stringify(rows)})`, rows.length === 1 && rows[0].status === "planned" && rows[0].proposed_by_id === jonas.id && rows[0].title === "Ramen in Ehrenfeld" && rows[0].google_event_id === null && rows[0].sync_status === "synced");
const mine = await headline();
check(`the Beet waits for Sam (${mine})`, mine === "wartet auf sam.");

await choose("Sam schlägt vor", "theirs");
rows = await dates();
check(`theirs: one planned date proposed by Sam (${rows.length})`, rows.length === 1 && rows[0].proposed_by_id === sam.id);
await headline();
check("the Beet asks me to say yes", await j.getByRole("button", { name: /Zusagen/ }).first().isVisible());
await j.screenshot({ path: `${OUT}m34-02-zusagen.png` });

await choose("Date steht", "confirmed");
rows = await dates();
check(`confirmed: one confirmed date (${rows.length})`, rows.length === 1 && rows[0].status === "confirmed");
const stands = await headline();
check(`the Beet says the date stands (${stands})`, stands === "date steht.");
await j.screenshot({ path: `${OUT}m34-03-steht.png` });

// A real date (with its Google event) is cancelled the normal way, not deleted.
await db.query("UPDATE date_plans SET google_event_id = 'real-event' WHERE couple_id = $1 AND status = 'confirmed'", [couple.id]);
await choose("Kein Date", "none");
const { rows: all } = await db.query("SELECT status FROM date_plans WHERE couple_id = $1", [couple.id]);
check(`none: the real date is cancelled, nothing else is left (${JSON.stringify(all)})`, all.length === 1 && all[0].status === "cancelled");
const back = await headline();
check(`the Beet is back to my turn (${back})`, back === "du bist dran.");

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
