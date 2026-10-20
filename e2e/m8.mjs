// M6 end-to-end check: reminders and partner pushes, delivered as real encrypted Web Push
// to a local push-service mock and decrypted with the "browser" keys.
import { createCipheriv, createECDH, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { createRequire } from "node:module";
import { DateTime } from "luxon";
import pg from "pg";
import { fitsScreen } from "./flow.mjs";
import { chromium } from "playwright";
import { startMock } from "./google-mock.mjs";
import { resetDb } from "./db.mjs";

const require = createRequire(new URL("../package.json", import.meta.url));
const ece = require("http_ece");

const BASE = "http://localhost:3000";
const CERTS = new URL("./.tmp/certs", import.meta.url).pathname;
const CRON = { headers: { Authorization: "Bearer test-cron-secret-123456" } };
const ZONE = "Europe/Berlin";
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
const encrypt = (text) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
};

// --- push service mock -----------------------------------------------------------------
const devicesKeys = {};
function makeDevice(name) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  devicesKeys[name] = { ecdh, auth };
  return { endpoint: `https://localhost:4020/push/${name}`, p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
}
const inbox = []; // { device, title, body, url, headers }
const pushServer = createServer({ key: readFileSync(`${CERTS}/key.pem`), cert: readFileSync(`${CERTS}/cert.pem`) }, (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const device = req.url.split("/").pop();
    if (device === "gone") {
      res.statusCode = 410;
      return res.end();
    }
    const { ecdh, auth } = devicesKeys[device];
    const plain = ece.decrypt(Buffer.concat(chunks), { version: "aes128gcm", privateKey: ecdh, authSecret: auth });
    inbox.push({ device, ...JSON.parse(plain.toString("utf8")), headers: req.headers });
    res.statusCode = 201;
    res.end();
  });
});
await new Promise((r) => pushServer.listen(4020, r));
const google = await startMock(4010);

// --- data ------------------------------------------------------------------------------
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
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id) VALUES ($1, $2)", [couple.id, jonas.id]);
async function subscribe(userId, name) {
  const d = makeDevice(name);
  await db.query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)", [userId, d.endpoint, d.p256dh, d.auth]);
}
await subscribe(jonas.id, "jonas-phone");
await subscribe(sam.id, "sam-phone");
await subscribe(sam.id, "gone");

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const titles = (device) => inbox.filter((m) => m.device === device).map((m) => m.title);
/** Moves the app clock to a Berlin wall-clock time and runs the cron tick. */
async function at(when) {
  const target = (when instanceof Date ? DateTime.fromJSDate(when) : when).toMillis();
  await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [couple.id, Math.round((target - Date.now()) / 60_000)]);
  const res = await fetch(`${BASE}/api/cron/tick`, CRON).then((r) => r.json());
  await new Promise((r) => setTimeout(r, 300));
  return res;
}

// --- a date that happened last week ------------------------------------------------------
const lastWeek = DateTime.now().setZone(ZONE).startOf("week").minus({ weeks: 1 });
const { rows: [c1] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status, closed_at)
   VALUES ($1, 1, $2, $3, $4, 'alternating', $5, 'done', now()) RETURNING id`,
  [couple.id, lastWeek.toJSDate(), lastWeek.plus({ weeks: 1 }).toJSDate(), lastWeek.plus({ days: 3, hours: 20 }).toJSDate(), jonas.id],
);
const start = lastWeek.plus({ days: 4 }).set({ hour: 19 });
const { rows: [d1] } = await db.query(
  `INSERT INTO date_plans (couple_id, cycle_id, title, size, location, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status)
   VALUES ($1, $2, 'Picknick im Stadtwald', 'small', 'Stadtwald', $3, $4, $5, $5, 'done', 'synced') RETURNING id`,
  [couple.id, c1.id, start.toJSDate(), start.plus({ hours: 3 }).toJSDate(), jonas.id],
);

// A photo of the date: the start shows it in "Wie war's?" (the file itself does not matter here)
const { rows: [photo] } = await db.query(
  "INSERT INTO date_photos (couple_id, date_id, uploaded_by_id, full_path, thumb_path, width, height, bytes) VALUES ($1, $2, $3, 'x/full.jpg', 'x/thumb.jpg', 800, 600, 1000) RETURNING id",
  [couple.id, d1.id, jonas.id],
);

// 1) The day after, 11:00: both get "Wie war's?"
await at(start.plus({ days: 1 }).set({ hour: 10, minute: 50 }));
check("no review reminder before 11:00", !inbox.some((m) => m.tag === "review"));
await at(start.plus({ days: 1 }).set({ hour: 11, minute: 5 }));
const asks = inbox.filter((m) => m.title === "Wie war's? 💭");
check(`both are asked "Wie war's?" (${asks.map((m) => m.device)})`, asks.length === 2);
check(`it links to the date (${asks[0]?.url})`, asks[0]?.url === `/dates/${d1.id}`);
await at(start.plus({ days: 1 }).set({ hour: 11, minute: 10 }));
check("and only once", inbox.filter((m) => m.title === "Wie war's? 💭").length === 2);
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = 0 WHERE couple_id = $1", [couple.id]);
inbox.length = 0;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", ...options });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}
const OUT = new URL("./shots/", import.meta.url).pathname;

// 2) Home asks Sam; Sam reviews first
const s = await pageFor(sam.token);
await s.goto(`${BASE}/`);
// The box shows the date, its first photo and five hearts – a tap on a heart is the answer.
// (Sam's turn to plan: the box says "Du bist dran!", the review has its own card; otherwise it is the box.)
const reviewBox = s.locator("[data-review-start]").filter({ visible: true });
await reviewBox.waitFor({ timeout: 15000 });
check("the start page asks for the review", s.url() === `${BASE}/plan`);
check("\"Wie war's?\" shows title, date, first photo and five hearts", (await reviewBox.getByText("Picknick im Stadtwald", { exact: true }).isVisible()) && (await reviewBox.locator(`img[src^="/api/photos/${photo.id}"]`).count()) === 1 && (await reviewBox.getByRole("link", { name: /Herz/ }).count()) === 5);
check("…on the Beet (its own line when another step heads it)", (await s.locator('[data-next-step] [data-leaf="fresh"], [data-review-card]').count()) >= 1);
check("the review state fits the screen", await fitsScreen(s));
await s.screenshot({ path: `${OUT}m8-01-home-prompt.png` });
await reviewBox.getByRole("link", { name: "4 Herzen" }).click();
await s.waitForURL(new RegExp(`/dates/${d1.id}\\?herzen=4`), { timeout: 10000 });
await s.getByRole("heading", { name: "Wie war's für dich?" }).waitFor({ timeout: 10000 });
check("a tap on a heart opens the review with that number chosen", await s.getByRole("radio", { name: "4 Herzen" }).isChecked());
await s.getByText("Richtig schön 🥰").waitFor();
await s.getByLabel("Was war besonders?").fill("Das Eis am Weiher!");
await s.getByRole("button", { name: "unbedingt" }).click();
await s.screenshot({ path: `${OUT}m8-02-review-form.png` });
await s.getByRole("button", { name: "Blatt speichern" }).click();
await s.getByRole("heading", { name: "Deine Herzen" }).waitFor({ timeout: 10000 });
const { rows: [samReview] } = await db.query("SELECT again FROM date_reviews r JOIN users u ON u.id = r.user_id WHERE u.name = 'Sam'");
check(`Sam's review saved, "Nochmal machen? unbedingt" too (${samReview?.again})`, samReview?.again === "yes");
await new Promise((r) => setTimeout(r, 800));
check(`Jonas is told (${titles("jonas-phone")})`, titles("jonas-phone").some((t) => t.startsWith("Sam hat verraten")));
await s.goto(`${BASE}/dates`);
await s.getByRole("heading", { name: "unser beet." }).waitFor({ timeout: 10000 });
check("review prompt gone after reviewing", (await s.getByRole("link", { name: /Wie war „Picknick/ }).count()) === 0);

// 3) Jonas: Sam's hearts are hidden until he reviews
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/dates`);
await j.getByRole("heading", { name: "unser beet." }).waitFor({ timeout: 15000 });
check("list: Sam's review is locked", await j.getByText("hat bewertet 🔒").isVisible());
check("the Archiv shows no hearts or averages that could give Sam's hidden review away", (await j.locator("dl").count()) === 0 && !(await j.locator("main").innerText()).includes("Ø"));
await j.getByRole("link", { name: /Picknick im Stadtwald/ }).last().click();
await j.getByText("Sam hat schon bewertet").waitFor({ timeout: 10000 });
check("detail: note not visible yet", !(await j.getByText("Das Eis am Weiher!").isVisible()));
// Tap the heart itself (the radio is visually hidden inside the label).
await j.getByLabel("5 Herzen").locator("xpath=..").click();
await j.getByRole("button", { name: "Blatt speichern" }).click();
await j.getByText("Deine Herzen", { exact: true }).waitFor({ timeout: 10000 });
await j.getByRole("tab", { name: "Sam" }).click();
await j.getByText("Das Eis am Weiher!").waitFor({ timeout: 10000 });
check("after reviewing, Sam's note is visible", true);
await j.screenshot({ path: `${OUT}m8-03-detail.png`, fullPage: true });
check("date page (review) fits the screen", await fitsScreen(j));
await new Promise((r) => setTimeout(r, 800));
check(`Sam is told both are in (${titles("sam-phone")})`, titles("sam-phone").some((t) => t.includes("bewertet 💞")));

// 4) Change the review: no new push
const before = inbox.length;
await j.getByRole("tab", { name: /Deine Herzen/ }).click();
await j.getByText("Meine Bewertung ändern").click();
await j.locator("label", { has: j.locator('input[value="3"]') }).click();
await j.getByRole("button", { name: "Speichern" }).click();
await j.getByRole("img", { name: "3 von 5 Herzen" }).first().waitFor({ timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
check("editing works and does not push again", inbox.length === before);

// 5) Stats + nav
await j.goto(`${BASE}/dates`);
await j.getByRole("heading", { name: "unser beet." }).waitFor({ timeout: 10000 });
check("the Archiv counts its dates in the header", await j.locator("header").filter({ visible: true }).first().getByText(/1 Date/).isVisible());
await j.screenshot({ path: `${OUT}m8-04-list.png`, fullPage: true });
check("dates history fits the screen", await fitsScreen(j));
const jd = await pageFor(jonas.token, { colorScheme: "dark" });
await jd.goto(`${BASE}/dates`);
await jd.getByRole("heading", { name: "unser beet." }).waitFor({ timeout: 10000 });
await jd.screenshot({ path: `${OUT}m8-05-list-dark.png`, fullPage: true });
await j.goto(`${BASE}/`);
await j.getByRole("link", { name: "Einstellungen" }).click();
await j.getByRole("heading", { name: "setup." }).waitFor({ timeout: 10000 });
check("settings reachable from the header", true);
await j.getByRole("link", { name: /^Mehr/ }).click();
await j.getByRole("link", { name: /Erinnerungen im Detail/ }).click();
await j.getByText("Welche Erinnerungen?").click();
await j.getByText("Wie war's? (am Tag nach dem Date)").waitFor({ timeout: 10000 }).catch(() => {});
check("review reminder can be switched off", await j.getByText("Wie war's? (am Tag nach dem Date)").isVisible());

// 6) Someone else's date id → 404
// (Streamed page: the status is already 200, the not-found screen is rendered in place.)
await j.goto(`${BASE}/dates/00000000-0000-0000-0000-000000000000`);
check("unknown date → not-found screen", await j.getByText("Hier ist nichts").waitFor({ timeout: 10000 }).then(() => true, () => false));

await browser.close();
await google.close?.();
pushServer.close();
await db.end();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
