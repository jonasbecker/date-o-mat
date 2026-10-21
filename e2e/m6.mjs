// M6 end-to-end check: reminders and partner pushes, delivered as real encrypted Web Push
// to a local push-service mock and decrypted with the "browser" keys.
import { createCipheriv, createECDH, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { createRequire } from "node:module";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium, devices } from "playwright";
import { backAtStart, openTimes, SEND } from "./flow.mjs";
import { startMock } from "./google-mock.mjs";
import { resetDb } from "./db.mjs";

const require = createRequire(new URL("../package.json", import.meta.url));
const ece = require("http_ece");

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
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
await db.query("INSERT INTO ideas (couple_id, title, size, location, created_by_id) VALUES ($1, 'Picknick im Stadtwald', 'small', 'Stadtwald', $2)", [couple.id, jonas.id]);
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
const monday = DateTime.now().setZone(ZONE).startOf("week");

// 1) Round starts: only the planner gets "Du bist dran" – at 09:00, not at midnight
await at(monday.set({ hour: 7 }));
check("no turn reminder before 09:00", inbox.length === 0);
await at(monday.set({ hour: 9, minute: 5 }));
check(`Jonas: "Du bist dran! 🎯" (${titles("jonas-phone")})`, titles("jonas-phone").join() === "Du bist dran! 🎯");
check("Sam gets nothing – not her turn", titles("sam-phone").length === 0);
const turn = inbox[0];
check(`push links to the plan page (${turn?.url})`, turn?.url === "/plan");
check("push uses VAPID and a TTL", /vapid/i.test(turn?.headers.authorization ?? "") && Number(turn?.headers.ttl) > 0);
await at(monday.set({ hour: 9, minute: 10 }));
check("a second tick does not send it again", titles("jonas-phone").length === 1);

// 2) 24 h before the deadline (Thursday 20:00 → Wednesday 20:00)
const { rows: [round] } = await db.query("SELECT deadline_at FROM cycles WHERE couple_id = $1", [couple.id]);
await at(DateTime.fromJSDate(round.deadline_at).minus({ hours: 24 }).plus({ minutes: 3 }));
check(`Jonas: "Noch 24 Stunden ⏰"`, titles("jonas-phone").includes("Noch 24 Stunden ⏰"));

// 3) Jonas plans → Sam is told right away; the dead device is cleaned up
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, options = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", ...options });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  return ctx.newPage();
}
const j = await pageFor(jonas.token);
await openTimes(j, BASE);
await j.getByRole("button", { name: SEND }).click();
await backAtStart(j, BASE);
await new Promise((r) => setTimeout(r, 1500));
check(`Sam: "Jonas hat ein Date geplant 🎉" (${titles("sam-phone")})`, titles("sam-phone").includes("Jonas hat ein Date geplant 🎉"));
const planned = inbox.find((m) => m.title.startsWith("Jonas hat"));
check(`…with what and when (${planned?.body})`, planned?.body.startsWith("Picknick im Stadtwald ·") && planned.body.endsWith("passt dir das?"));
const gone = (await db.query("SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint LIKE '%/gone'")).rows[0].n;
check("subscription answered with 410 is removed", gone === 0);

// 4) Sam confirms → Jonas is told
const s = await pageFor(sam.token);
await s.goto(`${BASE}/`);
await s.getByRole("button", { name: "Zusagen" }).click();
await s.getByRole("heading", { name: "date steht." }).waitFor({ timeout: 10000 });
await new Promise((r) => setTimeout(r, 1500));
check(`Jonas: "Sam sagt: Passt! 💚"`, titles("jonas-phone").includes("Sam sagt: Passt! 💚"));

// 5) The evening before (19:00) and 2 hours before – both partners
const { rows: [date] } = await db.query("SELECT starts_at FROM date_plans WHERE couple_id = $1", [couple.id]);
const start = DateTime.fromJSDate(date.starts_at).setZone(ZONE);
await at(start.minus({ days: 1 }).set({ hour: 19, minute: 2 }));
check("both: 'Morgen ist Date-Tag 💞'", titles("jonas-phone").includes("Morgen ist Date-Tag 💞") && titles("sam-phone").includes("Morgen ist Date-Tag 💞"));
await at(start.minus({ hours: 2 }).plus({ minutes: 2 }));
check("both: 'In 2 Stunden: Picknick im Stadtwald 💞'", ["jonas-phone", "sam-phone"].every((d) => titles(d).includes("In 2 Stunden: Picknick im Stadtwald 💞")));
const soon = inbox.find((m) => m.title.startsWith("In 2 Stunden"));
check("'in 2 hours' is sent with high urgency", soon?.headers.urgency === "high");

// 6) Preferences: Sam turns partner news off → no push when Jonas cancels
await at(start.minus({ hours: 5 }));
await s.goto(`${BASE}/settings?t=push`);
await s.getByText("Welche Erinnerungen?").click();
const toggle = s.getByRole("switch", { name: /Jonas plant, bestätigt oder sagt ab/ });
await toggle.waitFor({ timeout: 10000 });
check("all reminder types are on by default", (await s.getByRole("switch").evaluateAll((els) => els.every((e) => e.getAttribute("aria-checked") === "true"))));
await toggle.click();
await new Promise((r) => setTimeout(r, 1000));
const { rows: [pref] } = await db.query("SELECT enabled FROM notification_prefs WHERE user_id = $1 AND type = 'partner_activity'", [sam.id]);
check("switch is stored", pref?.enabled === false);
await s.screenshot({ path: `${SHOTS}m6-01-settings.png` });
const before = titles("sam-phone").length;
await j.goto(`${BASE}/`);
// Changing and cancelling sit under "Details" (the date's own page).
await j.getByRole("link", { name: "Details ›" }).click();
await j.getByRole("button", { name: "Absagen" }).click();
await j.getByRole("button", { name: "Ja, absagen" }).click();
await j.waitForURL(`${BASE}/plan`, { timeout: 10000 });
await j.locator("[data-next-step]").filter({ visible: true }).first().waitFor({ timeout: 10000 });
await new Promise((r) => setTimeout(r, 1500));
check("Sam gets no 'abgesagt' push after turning it off", titles("sam-phone").length === before);

// 7) PWA basics
const manifest = await fetch(`${BASE}/manifest.webmanifest`).then((r) => r.json());
check(`manifest: standalone with icons (${manifest.icons?.length})`, manifest.display === "standalone" && manifest.icons.length === 3);
const statuses = await Promise.all(["/sw.js", "/icons/icon-192.png", "/icons/maskable-512.png", "/apple-icon.png"].map((p) => fetch(`${BASE}${p}`).then((r) => r.status)));
check(`service worker and icons are public (${statuses})`, statuses.every((st) => st === 200));
const swReady = await j.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
check("service worker gets registered", swReady);

// 8) iPhone in Safari (not installed) → install guide instead of a push button
const iphone = await pageFor(sam.token, { ...devices["iPhone 13"], locale: "de-DE", deviceScaleFactor: 2 });
await iphone.goto(`${BASE}/settings?t=push`);
await iphone.getByText("Erst auf den Home-Bildschirm").waitFor({ timeout: 10000 });
check("iOS browser: install guide in settings", (await iphone.getByRole("button", { name: /Push aktivieren/ }).count()) === 0);
await iphone.screenshot({ path: `${SHOTS}m6-02-ios-guide.png` });
await db.query("DELETE FROM push_subscriptions WHERE user_id = $1", [sam.id]);
await iphone.goto(`${BASE}/`);
await iphone.getByText("Leg den Date-O-Mat auf den Home-Bildschirm").waitFor({ timeout: 10000 });
check("iOS browser: checklist explains installing first", await iphone.getByText(/Teilen-Symbol → „Zum Home-Bildschirm“/).isVisible());
await iphone.screenshot({ path: `${SHOTS}m6-03-ios-home.png` });
check("iOS browser: the flower says reminders need the app", (await iphone.getByRole("button", { name: "So gehen Erinnerungen" }).innerText()).includes("erst als app"));
await iphone.getByRole("button", { name: "So gehen Erinnerungen" }).click();
check("…and \"So geht's\" opens the install guide", await iphone.locator("dialog[open]").getByText("Erst auf den Home-Bildschirm").isVisible());
await iphone.keyboard.press("Escape");

// The other person has no device: a quiet line for Jonas, snoozed for a week
await j.goto(`${BASE}/`);
const partnerLine = j.getByRole("button", { name: "Sam bekommt keine Erinnerungen – eine Woche ausblenden" });
await partnerLine.waitFor({ timeout: 15000 });
check("Jonas sees that Sam gets no reminders", true);
await j.screenshot({ path: `${SHOTS}m6-04-partner-line.png` });
await partnerLine.click();
await partnerLine.waitFor({ state: "hidden", timeout: 5000 });
await j.reload();
await j.locator("[data-next-step]").filter({ visible: true }).first().waitFor({ timeout: 15000 });
await j.waitForTimeout(500);
check("snoozed: still gone after a reload", (await partnerLine.count()) === 0);
await j.evaluate(() => localStorage.setItem("dom-partner-push-snoozed", String(Date.now() - 8 * 86_400_000)));
await j.reload();
await partnerLine.waitFor({ timeout: 15000 });
check("after a week the line is back", true);

await browser.close();
await db.end();
google.close();
pushServer.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
