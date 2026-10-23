// M22: the Top-Tipp fits the idea – daylight and weather for outdoor ideas (Köln), in the
// free times of the flow and in the suggestion mode. Weather comes from a mock (port 4050).
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { mondayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { fitsScreen, pickIdea, backToIdeas } from "./flow.mjs";
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

// --- weather mock: mild and dry, or (rain.weekend) rainy on Saturday and Sunday -------------------
const rain = { weekend: false, calls: 0 };
const weather = createServer((req, res) => {
  rain.calls++;
  const url = new URL(req.url, "http://x");
  const from = DateTime.fromISO(url.searchParams.get("start_date"), { zone: "Europe/Berlin" });
  const to = DateTime.fromISO(url.searchParams.get("end_date"), { zone: "Europe/Berlin" }).plus({ days: 1 });
  const time = [], temperature_2m = [], precipitation_probability = [], weather_code = [];
  for (let t = from; t < to; t = t.plus({ hours: 1 })) {
    const wet = rain.weekend && t.weekday >= 6;
    time.push(t.toFormat("yyyy-LL-dd'T'HH:mm"));
    temperature_2m.push(wet ? 11 : 13);
    precipitation_probability.push(wet ? 85 : 5);
    weather_code.push(wet ? 63 : 1);
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ hourly: { time, temperature_2m, precipitation_probability, weather_code } }));
});
await new Promise((r) => weather.listen(4050, r));

// --- data ---------------------------------------------------------------------------------------
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
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, mondayMorningOffset()]);
const idea = (title, setting, daysOld) =>
  db.query("INSERT INTO ideas (couple_id, title, size, setting, created_by_id, created_at) VALUES ($1, $2, 'small', $3, $4, now() - $5 * interval '1 day')", [couple.id, title, setting, jonas.id, daysOld]);
await idea("Picknick im Stadtwald", "outdoor", 30);
await idea("Sterne gucken am Rhein", "outdoor", 20);
await idea("Sushi-Abend", "indoor", 10);

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}
/** The first free time of step 2 as text, e.g. "So 25 14:00 – 16:00 ★ Top-Tipp Sonntag, 25. Oktober · Wochenende ☀️ 13°, trocken · hell bis 18:24". */
const topSlot = async (page) => {
  const li = page.locator("ol li").first();
  return `${await li.locator("button").getAttribute("aria-label")} ${await li.innerText()}`.replace(/\s+/g, " ");
};
const startHour = (text) => Number(/(\d\d):\d\d – \d\d:\d\d/.exec(text)?.[1]);
const isWeekend = (text) => /Samstag|Sonntag/.test(text);

const j = await pageFor(jonas.token);

// 1) An outdoor idea: a weekend afternoon in the light, with the reason
await j.goto(`${BASE}/plan?pick=1`);
await pickIdea(j, "Picknick im Stadtwald");
await j.locator("ol li").first().waitFor({ timeout: 20000 });
const picnic = await topSlot(j);
check(`Picknick: a weekend afternoon (${picnic})`, isWeekend(picnic) && startHour(picnic) >= 11 && startHour(picnic) < 17);
check("…with weather and when it gets dark", /(☀️|⛅|☁️) 13°, trocken · hell bis \d\d:\d\d/.test(picnic));
await j.screenshot({ path: `${OUT}m22-01-picnic.png` });
check("step 2 with the reason fits the screen", await fitsScreen(j));
check("one forecast request per search", rain.calls >= 1 && rain.calls <= 2);

// 2) An indoor idea: the plain ranking, no note
await backToIdeas(j);
await pickIdea(j, "Sushi-Abend");
const sushi = await topSlot(j);
check(`Sushi-Abend: an evening, nothing about weather (${sushi})`, startHour(sushi) >= 17 && !/hell bis|trocken|°/.test(sushi));

// 3) Outdoor, but the dark is the point: no penalty after sunset, weather still shown
await backToIdeas(j);
await pickIdea(j, "Sterne gucken am Rhein");
const stars = await topSlot(j);
check(`Sterne gucken: evening is fine (${stars})`, startHour(stars) >= 17 && !/hell bis/.test(stars) && /13°, trocken/.test(stars));
await j.screenshot({ path: `${OUT}m22-02-stars.png` });

// 4) Rain on the weekend: the outdoor idea moves to a dry weekday
rain.weekend = true;
await j.goto(`${BASE}/plan?pick=1`);
await pickIdea(j, "Picknick im Stadtwald");
await j.locator("ol li").first().waitFor({ timeout: 20000 });
const wet = await topSlot(j);
check(`rainy weekend: Picknick goes to a weekday (${wet})`, !isWeekend(wet) && !/Regen/.test(wet));
rain.weekend = false;

// 5) Suggestion mode: the oldest idea (Picknick) gets its own time – a weekend afternoon
await db.query("UPDATE couple_settings SET mode = 'suggestion' WHERE couple_id = $1", [couple.id]);
await db.query("UPDATE cycles SET mode = 'suggestion', planner_id = NULL WHERE couple_id = $1 AND status = 'open'", [couple.id]);
await j.goto(`${BASE}/plan`);
const proposal = j.locator("[data-suggestion]").filter({ visible: true });
await proposal.waitFor({ timeout: 20000 });
const text = (await proposal.innerText()).replace(/\s+/g, " ");
check(`proposal: Picknick on a weekend afternoon (${text})`, /Picknick im Stadtwald/.test(text) && /\b(Sa|So)\b/.test(text) && startHour(text) >= 11 && startHour(text) < 17);
await j.screenshot({ path: `${OUT}m22-03-proposal.png` });
check("the proposal state fits the screen", await fitsScreen(j));

// 6) The idea form has "Wo?" and saves it
await db.query("UPDATE couple_settings SET mode = 'alternating' WHERE couple_id = $1", [couple.id]);
await j.goto(`${BASE}/ideas`);
await j.waitForTimeout(800);
await j.getByRole("button", { name: "Idee hinzufügen" }).click();
await j.getByLabel("Was wollt ihr machen?").first().fill("Schlittschuhlaufen im Park");
await j.locator("dialog[open] summary").click();
await j.locator("dialog[open]").getByText("🌳 Draußen").click();
await j.locator("dialog[open]").getByRole("button", { name: "Speichern" }).click();
await j.getByText("Auf eurer Wunschliste!").waitFor({ timeout: 10000 });
const { rows: [saved] } = await db.query("SELECT setting FROM ideas WHERE title = 'Schlittschuhlaufen im Park'");
check(`"Wo?" – Draußen is saved (${saved?.setting})`, saved?.setting === "outdoor");

// 7) Dark mode of the slot list with a reason
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/plan?pick=1`);
await pickIdea(jd, "Picknick im Stadtwald");
await jd.locator("ol li").first().waitFor({ timeout: 20000 });
await jd.waitForTimeout(400);
await jd.screenshot({ path: `${OUT}m22-04-picnic-dark.png` });

await browser.close();
google.close();
weather.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
