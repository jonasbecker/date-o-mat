// M19: special days (anniversary, birthday) with reminders, old wishlist ideas resurfacing.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { startMock } from "./google-mock.mjs";
import { resetDb } from "./db.mjs";
import { answerArt } from "./claude-art.mjs";

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
await resetDb(db, "users, couples, sessions, ideas");
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

// App time: today 10:05 in Berlin (reminders go out at 10:00).
const today = DateTime.now().setZone(ZONE).startOf("day");
const appNow = today.set({ hour: 10, minute: 5 });
const offsetTo = (t) => Math.round((t.toMillis() - Date.now()) / 60_000);
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, offsetTo(appNow)]);
// Two ideas that have waited for months, never planned.
const oldIdea = async (title, days) =>
  (await db.query("INSERT INTO ideas (couple_id, title, size, created_by_id, created_at, updated_at) VALUES ($1, $2, 'small', $3, now() - ($4 || ' days')::interval, now() - ($4 || ' days')::interval) RETURNING id", [couple.id, title, jonas.id, days])).rows[0].id;
const pottery = await oldIdea("Töpferkurs", 150);
const zoo = await oldIdea("Zoo besuchen", 120);

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failures++; };

// --- fake Claude for the deck ----------------------------------------------------------------------
const claudeCalls = [];
const claude = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const request = JSON.parse(body);
    if (answerArt(request, res)) return;
    claudeCalls.push(request);
    const nouns = ["Eislaufen", "Freibad", "Glühweinmarkt", "Kürbisschnitzen", "Kino", "Bouldern", "Brunch", "Museum", "Karaoke", "Minigolf"];
    const seasons = ["winter", "summer", "winter", "autumn", "any", "any", "any", "any", "any", "any"];
    const cards = nouns.map((n, i) => ({ title: `${n} Abend`, description: "…", emoji: "✨", size: "small", cost_eur: 10, location: null, setting: "indoor", theme: "cozy", wildcard: false, event_index: null, best_season: seasons[i], motif: "kaffee", quips: { neutral: ["hm."], like: ["ja!"], nope: ["nö."] } }));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: request.model,
      content: [{ type: "text", text: JSON.stringify({ cards }) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 800 },
    }));
  });
});
await new Promise((r) => claude.listen(4030, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}

// 1) Settings: anniversary in 14 days (2nd), Sam's birthday in 5 days
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/settings?t=besondere-tage`);
await j.getByLabel("Besonderer Tag").waitFor({ timeout: 15000 });
await j.waitForTimeout(800);
async function addDay(kind, date, title) {
  await j.getByLabel("Besonderer Tag").selectOption(kind);
  if (title) await j.getByLabel("Name").fill(title);
  await j.locator("#special-date").fill(date.toISODate());
  await j.locator("#besondere-tage").getByRole("button", { name: "Hinzufügen" }).click();
  await j.waitForTimeout(1000);
}
await addDay("anniversary", today.plus({ days: 14 }).minus({ years: 2 }));
await addDay(`birthday:${sam.id}`, today.plus({ days: 5 }).minus({ years: 25 }));
await addDay("other", today.plus({ days: 100 }).minus({ years: 1 }), "Unser erstes Date");
const list = await j.locator("#besondere-tage li").allInnerTexts();
check(`settings list (${list.map((t) => t.split("\n")[0]).join(" | ")})`, list.length === 3 && list[0].includes("Sams Geburtstag (25)") && list[1].includes("2. Jahrestag") && list[1].includes("in 14 Tagen") && list[2].includes("Unser erstes Date"));
await j.screenshot({ path: `${OUT}m19-01-settings.png`, fullPage: false });

// 2) Home: Jonas sees both, Sam does not see her own birthday
await j.goto(`${BASE}/`);
await j.waitForURL(/\/(plan|dates)$/, { timeout: 15000 });
await j.locator("[data-next-step], h1:not(.sr-only)").filter({ visible: true }).first().waitFor({ timeout: 15000 });
check("Jonas: anniversary card", await j.getByText("💞 2. Jahrestag in 14 Tagen").isVisible());
check("Jonas: Sam's birthday card", await j.getByText("🎂 Sams Geburtstag (25) in 5 Tagen").isVisible());
check("plan link asks for a big date", (await j.getByRole("link", { name: "Großes Date planen →" }).getAttribute("href")) === "/plan?size=large");
await j.screenshot({ path: `${OUT}m19-02-home.png` });
const s = await pageFor(sam.token);
await s.goto(`${BASE}/`);
await s.waitForURL(/\/(plan|dates)$/, { timeout: 15000 });
await s.locator("[data-next-step], h1:not(.sr-only)").filter({ visible: true }).first().waitFor({ timeout: 15000 });
check("Sam: anniversary yes, own birthday no", (await s.getByText("💞 2. Jahrestag in 14 Tagen").isVisible()) && (await s.getByText(/Geburtstag/).count()) === 0);

// 3) Reminders: today 10:05 = 14 days before the anniversary → both; 3 days later → birthday only for Jonas
await fetch(`${BASE}/api/cron/tick`, CRON);
await fetch(`${BASE}/api/cron/tick`, CRON);
let log = (await db.query("SELECT user_id, ref_id FROM notification_log WHERE type = 'special_day' ORDER BY ref_id")).rows;
check(`anniversary reminder once for both (${log.length})`, log.length === 2 && log.every((r) => r.ref_id.endsWith("@14")));
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, offsetTo(appNow.plus({ days: 3 }))]);
await fetch(`${BASE}/api/cron/tick`, CRON);
log = (await db.query("SELECT user_id, ref_id FROM notification_log WHERE type = 'special_day' AND ref_id LIKE '%@2'")).rows;
check(`birthday reminder only for Jonas (${log.map((r) => (r.user_id === jonas.id ? "J" : "S")).join("")})`, log.length === 1 && log[0].user_id === jonas.id);
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, offsetTo(appNow)]);

// 4) The deck knows the anniversary is coming
await j.goto(`${BASE}/ideas/entdecken`);
const topCard = (p) => p.locator('[aria-roledescription="Karte"]');
const topTitle = async (p) => (await topCard(p).getAttribute("aria-label")) ?? "";
await topCard(j).waitFor({ timeout: 30000 });
check("deck prompt mentions the anniversary", claudeCalls.some((c) => /their anniversary in \d+ days/.test(c.messages[0].content)));

// 5) Old wishlist idea comes back as "noch Lust?" (the tick made one card today)
await j.waitForTimeout(800);
const revisitTitle = await topTitle(j);
check(`a revisit card is in the deck (${revisitTitle})`, revisitTitle === "Töpferkurs" && (await topCard(j).getByText(/🕰️ Liegt seit .+ im Regal/).isVisible()));
await j.screenshot({ path: `${OUT}m19-03-revisit.png` });
await j.getByRole("button", { name: "Auf den Kompost" }).dispatchEvent("click");
await j.getByText("sagt sam auch nein, fliegt sie raus.").waitFor({ timeout: 10000 });
check("one ✕ keeps the idea for now", (await db.query("SELECT archived_at FROM ideas WHERE id = $1", [pottery])).rows[0].archived_at === null);
await s.goto(`${BASE}/ideas/entdecken`);
await topCard(s).waitFor({ timeout: 15000 });
await s.waitForTimeout(800);
check("Sam gets the revisit card too", (await topTitle(s)) === "Töpferkurs");
await s.getByRole("button", { name: "Auf den Kompost" }).dispatchEvent("click");
await s.getByText("von der liste – ihr wart euch einig.").waitFor({ timeout: 10000 });
check("two ✕ remove it from the wishlist", (await db.query("SELECT archived_at FROM ideas WHERE id = $1", [pottery])).rows[0].archived_at !== null);
await s.getByRole("button", { name: "Rückgängig" }).click();
for (let i = 0; i < 50 && (await topTitle(s)) !== "Töpferkurs"; i++) await s.waitForTimeout(100);
await s.getByRole("button", { name: "Auf den Kompost" }).waitFor({ state: "attached" });
await s.waitForFunction(() => !document.querySelector('button[aria-label="Auf den Kompost"]')?.disabled, null, { timeout: 10000 });
check("undo puts it back on the wishlist", (await db.query("SELECT archived_at FROM ideas WHERE id = $1", [pottery])).rows[0].archived_at === null);
await s.getByRole("button", { name: "Auf den Kompost" }).dispatchEvent("click");
await s.getByText("von der liste – ihr wart euch einig.").waitFor({ timeout: 10000 });

// second old idea the next day: one 💚 keeps it
await db.query("UPDATE deck_cards SET created_at = now() - interval '1 day' WHERE kind = 'revisit'");
await fetch(`${BASE}/api/cron/tick`, CRON);
await j.goto(`${BASE}/ideas/entdecken`);
await topCard(j).waitFor({ timeout: 15000 });
await j.waitForTimeout(800);
check(`next day: the next old idea (${await topTitle(j)})`, (await topTitle(j)) === "Zoo besuchen");
await j.getByRole("button", { name: "Einpflanzen" }).dispatchEvent("click");
await j.getByText("bleibt auf eurer liste 💚").waitFor({ timeout: 10000 });
check("kept: card leaves the deck for both", (await db.query("SELECT status FROM deck_cards WHERE idea_id = $1", [zoo])).rows[0].status === "matched");

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
