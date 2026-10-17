// M15: "Läuft alles?" status, cron warning on the home screen, push when a calendar connection is lost.
import { createCipheriv, createECDH, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:https";
import { createRequire } from "node:module";
import pg from "pg";
import { chromium } from "playwright";
import { requests as googleRequests, startMock } from "./google-mock.mjs";
import { resetDb } from "./db.mjs";

const require = createRequire(new URL("../package.json", import.meta.url));
const ece = require("http_ece");

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const CERTS = new URL("./.tmp/certs", import.meta.url).pathname;
const CRON = { headers: { Authorization: "Bearer test-cron-secret-123456" } };
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
const encrypt = (text) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
};

// --- push service mock -----------------------------------------------------------------
const deviceKeys = {};
function makeDevice(name) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  deviceKeys[name] = { ecdh, auth };
  return { endpoint: `https://localhost:4020/push/${name}`, p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") };
}
const inbox = [];
const pushServer = createServer({ key: readFileSync(`${CERTS}/key.pem`), cert: readFileSync(`${CERTS}/cert.pem`) }, (req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const device = req.url.split("/").pop();
    const { ecdh, auth } = deviceKeys[device];
    const plain = ece.decrypt(Buffer.concat(chunks), { version: "aes128gcm", privateKey: ecdh, authSecret: auth });
    inbox.push({ device, ...JSON.parse(plain.toString("utf8")) });
    res.statusCode = 201;
    res.end();
  });
});
await new Promise((r) => pushServer.listen(4020, r));
await startMock(4010);

// --- data ------------------------------------------------------------------------------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions, ideas, app_status");
const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
async function makeUser(name, email, color, accessToken, refreshToken, createdAt) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color, createdAt],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  await db.query(
    `INSERT INTO google_connections (user_id, refresh_token_enc, access_token_enc, access_token_expires_at, busy_calendar_ids)
     VALUES ($1, $2, $3, now() + interval '1 hour', '{primary}')`,
    [rows[0].id, encrypt(refreshToken), encrypt(accessToken)],
  );
  const device = makeDevice(name.toLowerCase());
  await db.query("INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)", [rows[0].id, device.endpoint, device.p256dh, device.auth]);
  return { id: rows[0].id, token };
}
// Jonas' refresh token has been revoked at Google – it shows once his access token expires.
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas", "revoked-refresh", "2026-01-01");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "fake-refresh", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id) VALUES ($1, $2)", [couple.id, jonas.id]);
await db.query("INSERT INTO ideas (couple_id, title, size, created_by_id) VALUES ($1, 'Picknick im Stadtwald', 'small', $2)", [couple.id, jonas.id]);

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
const status = (p) => p.locator("section#status");

// 1) Cron never ran: settings say so, home stays quiet
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/settings?t=status`);
await status(j).getByText(/Dinge? brauchen? euch|Eine Sache braucht euch/).waitFor({ timeout: 15000 });
check("never ran → shown in settings", await status(j).getByText("Noch nie gelaufen").isVisible());
check("push devices listed", await status(j).getByText("Jonas: 1 Gerät · Sam: 1 Gerät").isVisible());
check("AI usage listed", await status(j).getByText(/Heute: Ideen 0\/20 · Stapel 0\/6 · Links 0\/30 · Events 0\/40/).isVisible());
await j.goto(`${BASE}/`);
await j.waitForURL(/\/(plan|dates)$/, { timeout: 15000 });
await j.locator("[data-next-step], h1:not(.sr-only)").filter({ visible: true }).first().waitFor({ timeout: 15000 });
check("no cron banner before the first run", (await j.getByText(/Die Automatik ist zuletzt/).count()) === 0);

// 2) Tick runs → all fine
const tick = await fetch(`${BASE}/api/cron/tick`, CRON).then((r) => r.json());
const { rows: [stored] } = await db.query("SELECT value FROM app_status WHERE key = 'tick'");
check(`tick is recorded (${JSON.stringify(stored?.value)})`, stored?.value?.couples === 1 && tick.ok);
await j.goto(`${BASE}/settings?t=status`);
await status(j).getByText("✅ Alles läuft").waitFor({ timeout: 15000 });
check("tick row: just now", await status(j).getByText("Läuft – zuletzt gerade eben").isVisible());
await j.screenshot({ path: `${OUT}m15-01-all-fine.png`, fullPage: true });

// 3) Google revokes Jonas' grant: the next calendar access notices it → push to both, once
await db.query("UPDATE google_connections SET access_token_expires_at = now() - interval '1 hour' WHERE user_id = $1", [jonas.id]);
await j.goto(`${BASE}/plan?pick=1`); // the free times (step 1 loads them) ask Google
await j.waitForTimeout(1500);
const { rows: [conn] } = await db.query("SELECT status FROM google_connections WHERE user_id = $1", [jonas.id]);
check(`connection flagged (${conn.status})`, conn.status === "needs_reauth");
for (let i = 0; i < 20 && inbox.length < 2; i++) await new Promise((r) => setTimeout(r, 250));
const toJonas = inbox.find((m) => m.device === "jonas");
const toSam = inbox.find((m) => m.device === "sam");
check(`Jonas gets "${toJonas?.title}" → ${toJonas?.url}`, toJonas?.title === "Kalender getrennt 🔌" && toJonas.url === "/settings?t=kalender");
check(`Sam gets "${toSam?.title}"`, toSam?.title === "Jonas' Kalender ist getrennt 🔌" && toSam.body.includes("Sag Jonas Bescheid"));
const refreshCalls = googleRequests.filter((r) => r.url === "/token").length;
await j.goto(`${BASE}/plan?pick=1`); // the free times (step 1 loads them) ask Google
await fetch(`${BASE}/api/cron/tick`, CRON);
await j.waitForTimeout(800);
check(`no second push (${inbox.length} total), no new refresh attempt (${refreshCalls} → ${googleRequests.filter((r) => r.url === "/token").length})`, inbox.length === 2 && googleRequests.filter((r) => r.url === "/token").length === refreshCalls);

// 4) Sam's settings: the problem is named, with who has to act
const s = await pageFor(sam.token);
await s.goto(`${BASE}/settings?t=status`);
await status(s).getByText("⚠️ Eine Sache braucht euch").waitFor({ timeout: 15000 });
check("Sam sees Jonas' calendar problem", await status(s).getByText("Verbindung verloren – Jonas muss ihn in den Einstellungen neu verbinden.").isVisible());
await s.screenshot({ path: `${OUT}m15-02-partner-calendar.png`, fullPage: true });
await j.goto(`${BASE}/settings?t=status`);
check("Jonas gets a link to reconnect", (await status(j).getByRole("link", { name: "Verbindung verloren – bitte neu verbinden." }).getAttribute("href")) === "/settings?t=kalender");

// 5) Push preference "Wichtiges" off → no alert for that person
await db.query("UPDATE google_connections SET status = 'ok' WHERE user_id = $1", [jonas.id]);
await db.query("INSERT INTO notification_prefs (user_id, type, enabled) VALUES ($1, 'system', false)", [sam.id]);
await j.goto(`${BASE}/plan?pick=1`); // the free times (step 1 loads them) ask Google
for (let i = 0; i < 12 && inbox.length < 3; i++) await new Promise((r) => setTimeout(r, 250));
await new Promise((r) => setTimeout(r, 500));
check(`after reconnect + new revoke: only Jonas is told (${inbox.map((m) => m.device).join(",")})`, inbox.length === 3 && inbox[2].device === "jonas");

// 6) Cron stopped: banner on the home screen, warning in settings
await db.query("UPDATE google_connections SET status = 'ok', refresh_token_enc = $2, access_token_expires_at = now() + interval '1 hour' WHERE user_id = $1", [jonas.id, encrypt("fake-refresh")]);
await db.query(`UPDATE app_status SET value = jsonb_set(value, '{at}', to_jsonb(to_char((now() - interval '3 hours') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))) WHERE key = 'tick'`);
await j.goto(`${BASE}/`);
await j.waitForURL(/\/(plan|dates)$/, { timeout: 15000 });
await j.locator("[data-next-step], h1:not(.sr-only)").filter({ visible: true }).first().waitFor({ timeout: 15000 });
const banner = j.getByRole("alert").filter({ hasText: "Die Automatik ist zuletzt" });
check(`home banner (${await banner.innerText().catch(() => "–")})`, (await banner.count()) === 1 && (await banner.innerText()).includes("vor 3 Std."));
check("banner links to the status", (await banner.getAttribute("href")) === "/settings?t=status");
await j.screenshot({ path: `${OUT}m15-03-cron-banner.png` });
await j.goto(`${BASE}/settings?t=status`);
const lateRow = status(j).getByText(/Zuletzt vor 3 Std\. – sollte alle 5 Min\. laufen/);
await lateRow.waitFor({ timeout: 10000 }).catch(async () => console.log("DEBUG", await status(j).innerText().catch(() => "-")));
check("settings: tick is late", await lateRow.isVisible());
await fetch(`${BASE}/api/cron/tick`, CRON);
await j.goto(`${BASE}/`);
await j.waitForURL(/\/(plan|dates)$/, { timeout: 15000 });
await j.locator("[data-next-step], h1:not(.sr-only)").filter({ visible: true }).first().waitFor({ timeout: 15000 });
check("banner gone after the next tick", (await j.getByText(/Die Automatik ist zuletzt/).count()) === 0);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
