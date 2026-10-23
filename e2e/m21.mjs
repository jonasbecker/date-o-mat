// M21: surprise date, preparation checklist, route link, conversation cards, iPhone share key.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { backAtStart, fitsScreen, openTimes, SEND } from "./flow.mjs";
import { tuesdayMorningOffset } from "./clock.mjs";
import { events as googleEvents, startMock } from "./google-mock.mjs";
import { resetDb } from "./db.mjs";

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
// Tuesday morning: on a weekend the first free slot can be today, and a surprise is revealed on its day.
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset()]);
await db.query("INSERT INTO ideas (couple_id, title, size, location, cost_eur, created_by_id) VALUES ($1, 'Sushi-Abend', 'small', 'Belgisches Viertel', 50, $2)", [couple.id, jonas.id]);

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failures++; };

// --- fake TikTok oEmbed + Claude (for the share key) -----------------------------------------------
const thumb = readFileSync(new URL("./fixtures/strand.jpg", import.meta.url));
const site = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/oembed") {
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ title: "Neuer Dune-Film ab Donnerstag!", author_unique_id: "kinofan", thumbnail_url: "http://localhost:4060/thumb.jpg" }));
  }
  res.setHeader("content-type", "image/jpeg");
  res.end(thumb);
});
await new Promise((r) => site.listen(4060, r));
const claude = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const request = JSON.parse(body);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: request.model,
      content: [{ type: "text", text: JSON.stringify({ title: "Kino: Dune", size: "small", note: "Neuer Film.", cost_eur: 26, location: "Cinedom" }) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 100, output_tokens: 50 },
    }));
  });
});
await new Promise((r) => claude.listen(4030, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}
const setClock = async (t) => db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, Math.round((t.toMillis() - Date.now()) / 60_000)]);
const tick = () => fetch(`${BASE}/api/cron/tick`, CRON);

// 1) Jonas sets his start point
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/settings?t=unterwegs`);
await j.getByLabel("Dein Startpunkt").waitFor({ timeout: 15000 });
await j.waitForTimeout(800);
await j.getByLabel("Dein Startpunkt").fill("Ehrenfeld");
await j.locator("form", { has: j.getByLabel("Dein Startpunkt") }).getByRole("button", { name: "Speichern" }).click();
await j.getByText("Gespeichert ✓").first().waitFor({ timeout: 10000 });
check("start point saved", (await db.query("SELECT start_location FROM users WHERE id = $1", [jonas.id])).rows[0].start_location === "Ehrenfeld");

// 2) Jonas plans a surprise – an extra that shows up once they have had a date
await openTimes(j, BASE);
check("no surprise option before the first date", (await j.getByLabel("🎁 Als Überraschung planen").count()) === 0);
// An earlier round with a date (seq 0 – before the current one the app made).
const { rows: [oldCycle] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status, closed_at)
   VALUES ($1, 0, now() - interval '30 days', now() - interval '23 days', now() - interval '25 days', 'alternating', $2, 'done', now() - interval '23 days') RETURNING id`,
  [couple.id, jonas.id],
);
await db.query(
  `INSERT INTO date_plans (couple_id, cycle_id, title, size, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status)
   VALUES ($1, $2, 'Erstes Date', 'small', now() - interval '26 days', now() - interval '26 days' + interval '2 hours', $3, $3, 'done', 'synced')`,
  [couple.id, oldCycle.id, jonas.id],
);
await openTimes(j, BASE);
await j.waitForTimeout(800);
await j.getByLabel("🎁 Als Überraschung planen").check();
await j.getByLabel("Hinweis für Sam (optional)").fill("Hunger mitbringen!");
await j.screenshot({ path: `${OUT}m21-01-plan-surprise.png` });
await j.getByRole("button", { name: SEND }).click();
await backAtStart(j, BASE);
const { rows: [date] } = await db.query("SELECT * FROM date_plans WHERE couple_id = $1 ORDER BY created_at DESC LIMIT 1", [couple.id]);
check(`surprise saved (${date.title}, ${date.surprise_hint})`, date.surprise === true && date.surprise_hint === "Hunger mitbringen!" && date.title === "Sushi-Abend");
const event = [...googleEvents["token-jonas"].values()].at(-1);
check(`Google event keeps the secret (${event?.summary})`, event?.summary === "💞 Date: 🎁 Überraschung von Jonas" && !event.location && !JSON.stringify(event).includes("Sushi"));

// 3) The start shows the date in the step card; "Details ›" has the checklist with a suggestion and the route
await j.reload();
const jonasBox = j.locator("[data-next-step] [data-date-card]").filter({ visible: true });
await jonasBox.waitFor({ timeout: 15000 });
check("start: Jonas sees the real title in the box", (await jonasBox.innerText()).includes("Sushi-Abend"));
await j.getByRole("link", { name: "Details ›" }).click();
await j.getByText("Euer nächstes Date", { exact: true }).waitFor({ timeout: 15000 });
check("Jonas sees the real title and the surprise note", (await j.getByRole("heading", { name: "Sushi-Abend" }).isVisible()) && (await j.getByText(/🎁 Überraschung: Sam sieht bis zum Tag selbst nur Zeit und deinen Hinweis/).isVisible()));
const route = await j.getByRole("link", { name: "Route (ÖPNV)" }).getAttribute("href");
check(`route link with his start point (${route})`, new URL(route).searchParams.get("origin") === "Ehrenfeld, Köln" && new URL(route).searchParams.get("destination") === "Belgisches Viertel, Köln");
await j.getByText("📝 Vorbereitung").click();
await j.getByRole("button", { name: "+ Tisch reservieren" }).click();
await j.getByRole("checkbox", { name: "Tisch reservieren" }).waitFor({ timeout: 10000 });
await j.getByLabel("Neuer Punkt").fill("Blumen besorgen");
await j.getByRole("button", { name: "Dazu" }).click();
await j.getByRole("checkbox", { name: "Blumen besorgen" }).waitFor({ timeout: 10000 });
await j.getByRole("checkbox", { name: "Blumen besorgen" }).check();
await j.waitForTimeout(800);
const { rows: tasks } = await db.query("SELECT title, done_at IS NOT NULL AS done FROM date_tasks ORDER BY created_at");
check(`checklist stored (${JSON.stringify(tasks)})`, tasks.length === 2 && tasks[0].title === "Tisch reservieren" && !tasks[0].done && tasks[1].done);
await j.screenshot({ path: `${OUT}m21-02-jonas.png`, fullPage: true });
check("the date with its checklist fits the screen", await fitsScreen(j));

// 4) Sam sees only time and hint – no title, place, checklist; budget page keeps the secret too
const s = await pageFor(sam.token);
await s.goto(`${BASE}/`);
const samBox = s.locator("[data-next-step] [data-date-card]").filter({ visible: true });
await samBox.waitFor({ timeout: 15000 });
const samStart = await samBox.innerText();
check("Sam's start: surprise + hint, nothing given away", samStart.includes("Überraschung von Jonas") && samStart.includes("Hinweis: Hunger mitbringen!") && !/Sushi|Belgisches|Route/.test(samStart));
await s.getByRole("link", { name: "Details ›" }).click();
await s.getByText("Euer nächstes Date", { exact: true }).waitFor({ timeout: 15000 });
const samText = await s.locator("main").innerText();
check("Sam: surprise title + hint", samText.includes("🎁 Überraschung von Jonas") && samText.includes("Hinweis: Hunger mitbringen!") && samText.includes("erfährst du am Tag selbst"));
check("Sam: no title, place, checklist or route", !/Sushi|Belgisches|Vorbereitung|Route/.test(samText));
await s.screenshot({ path: `${OUT}m21-03-sam-surprise.png`, fullPage: true });

// Sam moves the time: details stay secret and unchanged
// later=1: also after the end of this round – late in the week only one slot may be left.
await s.goto(`${BASE}/plan?reschedule=${date.id}&later=1`);
await s.locator("ol li button").first().waitFor({ timeout: 20000 });
check("reschedule: only the time can change", await s.getByText("🤫 Das ist eine Überraschung").isVisible());
check("reschedule page does not show the title", !(await s.locator("main").innerText()).includes("Sushi"));
await s.waitForTimeout(800);
await s.locator("ol li button").nth(1).click();
await s.getByRole("button", { name: "Termin ändern" }).click();
await backAtStart(s, BASE);
const { rows: [moved] } = await db.query("SELECT title, location, surprise, starts_at, organizer_id FROM date_plans WHERE id = $1", [date.id]);
check(`moved, still the same secret (${moved.title})`, moved.title === "Sushi-Abend" && moved.location === "Belgisches Viertel" && moved.surprise === true && moved.starts_at.getTime() !== date.starts_at.getTime());

// Sam on the wishlist: tapping an idea cannot touch Jonas' surprise – and does not give it away
await s.goto(`${BASE}/ideas?ansicht=alle`);
await s.getByRole("link", { name: /^Sushi-Abend/ }).filter({ visible: true }).first().click();
const samMenu = s.locator("main"); // the idea opens full screen
await samMenu.getByText("das kann nur Jonas ändern", { exact: false }).waitFor({ timeout: 10000 });
check("Sam: no swap for Jonas' surprise", (await samMenu.getByRole("button", { name: /Statt/ }).count()) === 0 && (await samMenu.getByRole("button", { name: "Bearbeiten" }).isVisible()));
check("Sam: the surprise idea is not marked on the wishlist", (await s.getByText("📅 Nächstes Date").count()) === 0);
await s.keyboard.press("Escape");

// 5) The evening before: prep reminder only for Jonas (Sam must not know)
const start = DateTime.fromJSDate(moved.starts_at).setZone(ZONE);
await setClock(start.minus({ days: 1 }).set({ hour: 18, minute: 5 }));
await tick();
const { rows: prep } = await db.query("SELECT user_id FROM notification_log WHERE type = 'prep'");
check(`prep reminder only for Jonas (${prep.length})`, prep.length === 1 && prep[0].user_id === jonas.id);

// 6) The day itself: revealed – Google event gets the real title, Sam sees everything + conversation cards
await setClock(start.set({ hour: 0, minute: 30 }));
await tick();
const { rows: [revealed] } = await db.query("SELECT surprise_revealed_at FROM date_plans WHERE id = $1", [date.id]);
check("revealed in the database", revealed.surprise_revealed_at !== null);
const event2 = [...googleEvents["token-jonas"].values()].at(-1);
check(`Google event now says what it is (${event2?.summary})`, event2?.summary === "💞 Date: Sushi-Abend" && event2.location === "Belgisches Viertel");
await s.goto(`${BASE}/`);
await s.locator("[data-next-step] [data-date-card]").filter({ visible: true }).getByText("Sushi-Abend", { exact: true }).waitFor({ timeout: 15000 });
check("on the day: the start links the conversation cards", (await s.getByRole("link", { name: "💬 Gesprächskarten" }).getAttribute("href")) === "/fragen");
await s.getByRole("link", { name: "Details ›" }).click();
await s.getByText("Euer nächstes Date", { exact: true }).waitFor({ timeout: 15000 });
check("Sam sees the real date now", await s.getByRole("heading", { name: "Sushi-Abend" }).isVisible());
check("on the day: conversation cards with the date", await s.getByRole("button", { name: "💬 Gesprächskarte ziehen" }).isVisible());
await s.getByRole("button", { name: "💬 Gesprächskarte ziehen" }).click();
const question = await s.locator("p[aria-live=polite]").innerText();
await s.getByRole("button", { name: "Nächste Karte →" }).click();
check(`conversation cards (${question})`, question.endsWith("?") && (await s.locator("p[aria-live=polite]").innerText()) !== question);
await s.screenshot({ path: `${OUT}m21-04-revealed.png`, fullPage: true });
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, tuesdayMorningOffset()]);

// 7) iPhone share key: create, use, reject wrong keys, delete
await j.goto(`${BASE}/settings?t=unterwegs`);
await j.getByRole("button", { name: "Schlüssel erstellen" }).click();
const shareKey = (await j.locator("code").innerText()).trim();
check(`key shown once (${shareKey.slice(0, 8)}…)`, /^dom_[A-Za-z0-9_-]{40,}$/.test(shareKey));
check("only the hash is stored", (await db.query("SELECT share_token_hash FROM users WHERE id = $1", [jonas.id])).rows[0].share_token_hash === createHash("sha256").update(shareKey).digest("hex"));
const share = (key, body) => fetch(`${BASE}/api/share`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
const ok = await share(shareKey, { text: "Schau mal https://www.tiktok.com/@kinofan/video/123" });
const okText = await ok.text();
check(`share saves the idea (${ok.status}: ${okText})`, ok.status === 200 && okText === "💡 Auf eurer Wunschliste: Kino: Dune");
check("idea is on the wishlist", (await db.query("SELECT created_by_id FROM ideas WHERE title = 'Kino: Dune'")).rows[0]?.created_by_id === jonas.id);
check("no link → 400", (await share(shareKey, { text: "nur Text" })).status === 400);
check("wrong key → 401", (await share("dom_" + "x".repeat(43), { text: "https://www.tiktok.com/@a/video/1" })).status === 401);
await j.reload();
await j.getByRole("button", { name: "Schlüssel löschen" }).click();
await j.waitForTimeout(800);
check("deleted key → 401", (await share(shareKey, { text: "https://www.tiktok.com/@a/video/1" })).status === 401);

// 7b) Tapping an idea: do it instead of the next date – after a question; the time stays
await j.goto(`${BASE}/ideas?ansicht=alle`);
await j.getByRole("link", { name: /^Kino: Dune/ }).filter({ visible: true }).first().click();
const menu = j.locator("main"); // the idea opens full screen
await menu.getByRole("button", { name: "Statt „Sushi-Abend“ machen" }).click();
await menu.getByText("Willst du das ändern?", { exact: false }).waitFor({ timeout: 10000 });
await j.screenshot({ path: `${OUT}m21-05-swap.png` });
await menu.getByRole("button", { name: "Ja, ändern" }).click();
await j.waitForURL(`${BASE}/plan`, { timeout: 15000 });
const { rows: [swapped] } = await db.query("SELECT title, location, starts_at FROM date_plans WHERE id = $1", [date.id]);
check(`idea swapped, same time (${swapped.title})`, swapped.title === "Kino: Dune" && swapped.starts_at.getTime() === moved.starts_at.getTime());
// Back before the day, so it is Jonas' secret again: the Google event is updated but still hides it.
const event3 = [...googleEvents["token-jonas"].values()].at(-1);
check(`Google event updated, surprise kept (${event3?.summary})`, event3?.summary === "💞 Date: 🎁 Überraschung von Jonas" && !JSON.stringify(event3).includes("Sushi") && !JSON.stringify(event3).includes("Dune"));
await j.locator("[data-next-step] [data-date-card]").filter({ visible: true }).getByText("Kino: Dune", { exact: true }).waitFor({ timeout: 10000 });
await j.goto(`${BASE}/ideas?ansicht=alle`);
await j.getByRole("link", { name: /^Kino: Dune/ }).filter({ visible: true }).first().click();
await menu.getByText("📅 Das ist euer nächstes Date", { exact: false }).waitFor({ timeout: 10000 });
check("the date's own idea offers no swap", (await menu.getByRole("button", { name: /Statt/ }).count()) === 0);
await j.keyboard.press("Escape");

// 8) /fragen page
await j.goto(`${BASE}/fragen`);
await j.getByRole("button", { name: "💬 Gesprächskarte ziehen" }).click();
check("question page", (await j.locator("p[aria-live=polite]").innerText()).endsWith("?"));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
