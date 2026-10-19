// M11: AI idea suggestions (fake Claude + fake Open-Meteo).
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

import { createServer } from "node:http";
import { DateTime } from "luxon";

// --- fake Open-Meteo -----------------------------------------------------------------------
const weatherCalls = [];
const weather = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  weatherCalls.push(Object.fromEntries(url.searchParams));
  const from = DateTime.fromISO(url.searchParams.get("start_date"), { zone: "Europe/Berlin" });
  const to = DateTime.fromISO(url.searchParams.get("end_date"), { zone: "Europe/Berlin" }).plus({ days: 1 });
  const time = [], temperature_2m = [], precipitation_probability = [], weather_code = [];
  for (let t = from; t < to; t = t.plus({ hours: 1 })) {
    time.push(t.toFormat("yyyy-LL-dd'T'HH:mm"));
    temperature_2m.push(10 + (t.hour % 6));
    precipitation_probability.push(t.hour >= 18 ? 70 : 10);
    weather_code.push(t.hour >= 18 ? 61 : 2);
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ hourly: { time, temperature_2m, precipitation_probability, weather_code } }));
});
await new Promise((r) => weather.listen(4050, r));

// --- fake Claude -------------------------------------------------------------------------------
const claudeCalls = [];
const claude = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const request = JSON.parse(body);
    claudeCalls.push(request);
    const n = claudeCalls.length;
    const ideas = [
      { title: "Picknick im Stadtwald", description: "Steht schon auf der Liste.", why: "-", size: "small", cost_eur: 0, location: "Lindenthal", setting: "outdoor" },
      { title: `Sternschnuppen am Rhein ${n}`, description: "Decke, Tee und Blick in den Himmel.", why: "Klarer Abend, gratis.", size: "small", cost_eur: 0, location: "Rheinpark", setting: "outdoor" },
      { title: `Lichterspaziergang Altstadt ${n}`, description: "Durch die beleuchteten Gassen bis zum Dom.", why: "Romantisch und kostenlos.", size: "large", cost_eur: 0, location: "Altstadt", setting: "outdoor" },
      { title: `Tee-Verkostung ${n}`, description: "In einem kleinen Teeladen probieren.", why: "Falls es doch regnet.", size: "small", cost_eur: 12.6, location: "Belgisches Viertel", setting: "indoor" },
    ];
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: request.model,
      content: [{ type: "text", text: JSON.stringify({ ideas }) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 800, output_tokens: 300 },
    }));
  });
});
await new Promise((r) => claude.listen(4030, r));

// 1) Plan → "Was anderes" → "✨ 3 Ideen von der KI": follows the shared filter, knows slot, size and weather
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/plan?pick=1`);
await j.getByRole("heading", { name: "Was wollt ihr machen?" }).waitFor({ timeout: 20000 });
await j.waitForTimeout(800);
await j.getByRole("button", { name: "Filter", exact: true }).click();
await j.locator("dialog[open]").getByRole("button", { name: "🆓 Gratis" }).click();
await j.locator("dialog[open]").getByRole("button", { name: "🌳 Draußen" }).click();
await j.locator("dialog[open]").getByRole("button", { name: "Fertig" }).click();
await j.getByRole("button", { name: "Was anderes" }).click();
const sheet = j.locator("dialog[open]");
// The free times asked for the forecast on their own (for outdoor ideas); count only the AI request.
const weatherBefore = weatherCalls.length;
await sheet.getByRole("button", { name: "✨ 3 Ideen von der KI" }).click();
await sheet.getByText("Sternschnuppen am Rhein 1").waitFor({ timeout: 15000 });
const cards = await sheet.locator("article").allInnerTexts();
check(`suggestions shown, wishlist duplicate filtered (${cards.length})`, cards.length >= 2 && !cards.some((t) => t.includes("Picknick im Stadtwald")));
check("all suggestions match the slot size (small)", cards.every((t) => t.includes("Kurz")));
const first = claudeCalls[0];
const prompt = first.messages[0].content;
check(`model claude-haiku-5-5 with JSON schema (${first.model})`, first.model === "claude-haiku-5-5" && first.output_config?.format?.type === "json_schema");
check("prompt: budget and outdoors from the filter, wishlist titles", prompt.includes("free of charge") && prompt.includes("outdoors") && prompt.includes("Kletterhalle ausprobieren"));
check("prompt: slot time, size and weather", /Time for the date: \w+, \d+\. \w+, \d\d:\d\d/.test(prompt) && prompt.includes("small date") && prompt.includes("°C"));
// Word boundaries: "Samstag" is a weekday, not Sam.
check("prompt: no names, e-mails or notes", !/\bJonas\b|\bSam\b|example\.com/.test(prompt + first.system));
const weatherLine = await sheet.getByText(/Wetter:/).innerText();
check(`weather for the slot shown (${weatherLine})`, /°C/.test(weatherLine) && weatherCalls.length - weatherBefore === 1);
await j.screenshot({ path: `${OUT}m11-02-plan.png` });
await sheet.locator("article", { hasText: "Tee-Verkostung 1" }).getByRole("button", { name: "Nehmen" }).click();
await j.locator("div", { hasText: "Ihr macht" }).getByText("Tee-Verkostung 1", { exact: true }).first().waitFor({ timeout: 10000 });
const { rows: aiIdeas } = await db.query("SELECT title, source, cost_eur FROM ideas WHERE source = 'ai'");
check(`"Nehmen" saves it as AI idea and selects it (${JSON.stringify(aiIdeas[0])})`, aiIdeas.length === 1 && aiIdeas[0].title === "Tee-Verkostung 1");
await j.screenshot({ path: `${OUT}m11-01-wishlist.png` });

// 2) Daily limit
const { rows: [usage] } = await db.query("SELECT count(*)::int AS c, sum(input_tokens)::int AS t FROM ai_requests WHERE kind = 'ideas'");
check(`usage logged (${usage.c} requests, ${usage.t} input tokens)`, usage.c === 1 && usage.t === 800);
await db.query(`INSERT INTO ai_requests (couple_id, kind, model) SELECT $1, 'ideas', 'claude-haiku-5-5' FROM generate_series(1, 19)`, [couple.id]);
await j.getByRole("button", { name: "← Andere Idee" }).click();
await j.getByRole("button", { name: "Was anderes" }).click();
await j.locator("dialog[open]").getByRole("button", { name: "✨ 3 Ideen von der KI" }).click();
await j.getByText("Für heute sind die KI-Vorschläge aufgebraucht").waitFor({ timeout: 10000 });
check("21st request today is refused without calling Claude", claudeCalls.length === 1);

// 3) Dark mode look
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/plan?pick=1`);
await jd.getByRole("button", { name: "Was anderes" }).click();
await jd.locator("dialog[open]").getByRole("button", { name: "✨ 3 Ideen von der KI" }).waitFor({ timeout: 15000 });
await jd.screenshot({ path: `${OUT}m11-03-ideas-dark.png` });

await browser.close();
google.close();
claude.close();
weather.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
