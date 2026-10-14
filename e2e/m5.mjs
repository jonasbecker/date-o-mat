// M5 end-to-end check: plan → Google invitation → confirm → reschedule → cancel, plus sync edge cases.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium } from "playwright";
import { BUSY, events, failures, requests, startMock } from "./google-mock.mjs";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const CRON = { headers: { Authorization: "Bearer test-cron-secret-123456" } };
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
const encrypt = (text) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
};

const mock = await startMock(4010);
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
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id) VALUES ($1, $2)", [couple.id, jonas.id]);
for (const [title, size, days, location] of [
  ["Picknick im Stadtwald", "small", 3, "Stadtwald"],
  ["Ramen kochen", "small", 1, null],
  ["Wandern im Siebengebirge", "large", 2, "Königswinter"],
]) {
  await db.query(
    "INSERT INTO ideas (couple_id, title, size, location, cost_eur, created_by_id, created_at) VALUES ($1, $2, $3, $4, 0, $5, now() - ($6 || ' days')::interval)",
    [couple.id, title, size, location, jonas.id, days],
  );
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  return ctx.newPage();
}
let failuresCount = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failuresCount++;
};
const theDate = async () => (await db.query("SELECT * FROM date_plans WHERE couple_id = $1 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1", [couple.id])).rows[0];
const cycleStatus = async () => (await db.query("SELECT status FROM cycles WHERE couple_id = $1 ORDER BY seq DESC LIMIT 1", [couple.id])).rows[0]?.status;
const eventsOf = (token) => [...events[token].values()];
const tick = () => fetch(`${BASE}/api/cron/tick`, CRON).then((r) => r.json());
async function openPlan(page, query = "") {
  await page.goto(`${BASE}/plan${query}`);
  await page.locator("ol li button").first().waitFor({ timeout: 15000 });
}

const j = await pageFor(jonas.token);
const s = await pageFor(sam.token);

// 1) Jonas plans: Top-Tipp + oldest idea are preselected → one tap
await openPlan(j);
check("Top-Tipp slot is preselected", (await j.locator('ol li button[aria-pressed="true"]').count()) === 1);
check("oldest small idea is preselected", (await j.getByRole("button", { name: "Picknick im Stadtwald" }).getAttribute("aria-pressed")) === "true");
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m5-01-plan.png` });
const t0 = Date.now();
await j.getByRole("button", { name: "Date festlegen 🎉" }).click();
await j.waitForURL(`${BASE}/`, { timeout: 15000 });
console.log(`  (plan → saved → home in ${Date.now() - t0} ms incl. confetti)`);
let date = await theDate();
check("date saved as planned, Jonas organizer and proposer", date?.status === "planned" && date.organizer_id === jonas.id && date.proposed_by_id === jonas.id);
check("synced to Google with the deterministic event id", date.sync_status === "synced" && date.google_event_id === `dom${date.id.replaceAll("-", "")}`);
const ev = events["token-jonas"].get(date.google_event_id);
check("event is in Jonas' calendar and invites Sam", ev?.attendees?.[0]?.email === "partnerin@example.com");
check(`event title and location (${ev?.summary})`, ev?.summary === "💞 Date: Picknick im Stadtwald" && ev.location === "Stadtwald");
check("guest is notified (sendUpdates=all)", requests.some((r) => r.method === "POST" && r.url.includes("/events?sendUpdates=all")));
check("round is now 'planned'", (await cycleStatus()) === "planned");
await j.getByText("Wartet auf Sams „Passt!“").waitFor({ timeout: 10000 });
check("Jonas waits for Sam's confirmation", true);
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m5-02-home-planned.png` });

// 2) Sam confirms with confetti
await s.goto(`${BASE}/`);
await s.getByRole("button", { name: "Passt! 💚" }).waitFor({ timeout: 10000 });
await s.waitForTimeout(300);
await s.screenshot({ path: `${SHOTS}m5-03-partner-confirm.png` });
await s.getByRole("button", { name: "Passt! 💚" }).click();
await s.getByRole("heading", { name: "Date steht! 🎉" }).waitFor({ timeout: 10000 });
await s.waitForTimeout(150);
check("confetti flies after confirming", (await s.locator(".animate-confetti").count()) > 10);
await s.screenshot({ path: `${SHOTS}m5-04-confetti.png` });
date = await theDate();
check("Sam confirmed → date and round 'confirmed'", date.status === "confirmed" && date.confirmed_by_id === sam.id && (await cycleStatus()) === "confirmed");
await s.waitForTimeout(300);
await s.screenshot({ path: `${SHOTS}m5-05-confirmed.png` });

// 3) Sam proposes another time → same event is moved, Jonas has to confirm
await openPlan(s, `?reschedule=${date.id}`);
check("reschedule mode keeps the idea", (await s.getByRole("button", { name: "Picknick im Stadtwald" }).getAttribute("aria-pressed")) === "true");
await s.locator("ol li button").nth(1).click();
await s.getByRole("button", { name: "Termin ändern" }).click();
await s.waitForURL(`${BASE}/`, { timeout: 15000 });
const moved = await theDate();
check("same date row, new time, back to 'planned', Sam is proposer", moved.id === date.id && moved.starts_at.getTime() !== date.starts_at.getTime() && moved.status === "planned" && moved.proposed_by_id === sam.id);
const evMoved = events["token-jonas"].get(date.google_event_id);
check("Google event moved (PATCH), still only one event", evMoved.start.dateTime === moved.starts_at.toISOString() && eventsOf("token-jonas").length === 1);
await j.goto(`${BASE}/`);
await j.getByRole("button", { name: "Passt! 💚" }).click();
await j.getByRole("heading", { name: "Date steht! 🎉" }).waitFor({ timeout: 10000 });
check("now Jonas confirms Sam's new time", (await theDate()).confirmed_by_id === jonas.id);

// 4) The chosen slot got taken meanwhile → friendly error, nothing changes
await openPlan(j, `?reschedule=${date.id}`);
await j.locator("ol li button").nth(2).click();
const takenStart = await j.locator('form:has([role="tablist"]) input[name="start"]').inputValue();
const takenEnd = await j.locator('form:has([role="tablist"]) input[name="end"]').inputValue();
BUSY["token-sam"].primary.push({ start: takenStart, end: takenEnd });
await j.getByRole("button", { name: "Termin ändern" }).click();
await j.getByText("Dieser Zeitraum ist inzwischen belegt").waitFor({ timeout: 10000 });
check("taken slot is refused with a friendly message", (await theDate()).starts_at.getTime() === moved.starts_at.getTime());
BUSY["token-sam"].primary.pop();

// 5) Google fails while saving → stored as error, the tick retries
failures.status = 500;
failures.count = 2;
await openPlan(j, `?reschedule=${date.id}`);
await j.locator("ol li button").last().click();
await j.getByRole("button", { name: "Termin ändern" }).click();
await j.waitForURL(`${BASE}/`, { timeout: 15000 });
let failed = await theDate();
check(`failed sync is recorded (${failed.sync_status}, attempt ${failed.sync_attempts})`, failed.sync_status === "error" && failed.sync_attempts === 1);
await j.getByText("Google Kalender hakt gerade").waitFor({ timeout: 10000 });
check("home shows the sync hint", true);
await tick(); // second failure (count 2)
await tick(); // succeeds
failed = await theDate();
check(`tick retried until synced (${failed.sync_status})`, failed.sync_status === "synced");
check("event now has the latest time", events["token-jonas"].get(date.google_event_id).start.dateTime === failed.starts_at.toISOString());

// 6) Cancel → Google event deleted (guest notified), round reopens
await j.goto(`${BASE}/`);
await j.getByRole("button", { name: "Absagen" }).click();
await j.getByRole("button", { name: "Ja, absagen" }).click();
await j.getByRole("heading", { name: "Du bist dran!" }).waitFor({ timeout: 10000 });
const cancelled = (await db.query("SELECT status FROM date_plans WHERE id = $1", [date.id])).rows[0];
check("date cancelled and round open again", cancelled.status === "cancelled" && (await cycleStatus()) === "open");
check("Google event deleted with notification", events["token-jonas"].get(date.google_event_id).status === "cancelled" && requests.some((r) => r.method === "DELETE" && r.url.includes("sendUpdates=all")));

// 7) Suggestion mode: Sam takes the proposal → Sam is organizer, Jonas invited
await db.query("UPDATE couple_settings SET mode = 'suggestion' WHERE couple_id = $1", [couple.id]);
await db.query("UPDATE cycles SET mode = 'suggestion', planner_id = NULL WHERE couple_id = $1 AND status = 'open'", [couple.id]);
await s.goto(`${BASE}/`);
await s.getByRole("button", { name: "Übernehmen 🎉" }).waitFor({ timeout: 15000 });
await s.getByRole("button", { name: "Übernehmen 🎉" }).click();
await s.getByText("Wartet auf Jonass „Passt!“").or(s.getByText(/Wartet auf Jonas/)).first().waitFor({ timeout: 15000 });
const accepted = await theDate();
const sug = (await db.query("SELECT status FROM suggestions WHERE status = 'accepted'")).rows.length;
check("suggestion accepted → date with Sam as organizer", accepted.organizer_id === sam.id && sug === 1);
check("event is in Sam's calendar, inviting Jonas", events["token-sam"].get(accepted.google_event_id)?.attendees?.[0]?.email === "jonas@example.com");

// 8) Jonas accepts the invitation in Google Calendar → the tick marks it confirmed
events["token-sam"].get(accepted.google_event_id).attendees[0].responseStatus = "accepted";
await tick();
check("accepting in Google confirms the date in the app", (await theDate()).status === "confirmed");

// 9) Organizer deletes the event in Google Calendar → cancelled in the app
events["token-sam"].get(accepted.google_event_id).status = "cancelled";
await tick();
const afterDelete = (await db.query("SELECT status FROM date_plans WHERE id = $1", [accepted.id])).rows[0];
check("deleting the event in Google cancels the date", afterDelete.status === "cancelled");

// 10) A date that is over → round "done"; "hat doch nicht geklappt?" → skipped
await db.query("UPDATE couple_settings SET mode = 'alternating' WHERE couple_id = $1", [couple.id]);
await db.query("UPDATE cycles SET mode = 'alternating', planner_id = $2 WHERE couple_id = $1 AND status = 'open'", [couple.id, jonas.id]);
await openPlan(j);
const chosenEnd = new Date(await j.locator('form:has([role="tablist"]) input[name="end"]').inputValue());
await j.getByRole("button", { name: "Date festlegen 🎉" }).click();
await j.waitForURL(`${BASE}/`, { timeout: 15000 });
const roundEnd = (await db.query("SELECT ends_at FROM cycles WHERE couple_id = $1 ORDER BY seq DESC LIMIT 1", [couple.id])).rows[0].ends_at;
const minutes = Math.ceil((Math.min(chosenEnd.getTime() + 3_600_000, roundEnd.getTime() - 60_000) - Date.now()) / 60_000);
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, minutes]);
await j.goto(`${BASE}/`);
// The next step after a date is the review ("Wie war's?").
await j.getByRole("heading", { name: "Wie war's?" }).waitFor({ timeout: 10000 });
check("after the date: round counts as done, next step asks how it was", (await cycleStatus()) === "done");
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m5-06-done.png` });
await j.getByRole("button", { name: /hat doch nicht geklappt/ }).click();
await j.waitForTimeout(1500);
check("'hat doch nicht geklappt' marks the round as skipped", (await cycleStatus()) === "skipped");

await browser.close();
await db.end();
mock.close();
console.log(failuresCount ? `\n${failuresCount} check(s) failed` : "\nAll checks passed");
process.exit(failuresCount ? 1 : 0);
