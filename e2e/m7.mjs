// M7 visual tour: every screen, light and dark, at phone size.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
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
await startMock(4010); // Google stays up until the process exits
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

// 1) 404 inside the app
const j = await pageFor(jonas.token);
const res = await j.goto(`${BASE}/gibtsnicht`);
await j.getByText("Hier ist nichts").waitFor({ timeout: 10000 });
check(`404 page (status ${res.status()})`, res.status() === 404);
await j.screenshot({ path: `${OUT}m7-01-404.png` });
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/gibtsnicht`);
await jd.getByText("Hier ist nichts").waitFor({ timeout: 10000 });
await jd.screenshot({ path: `${OUT}m7-02-404-dark.png` });

// 2) Offline: the service worker serves the offline page for navigations
await j.goto(`${BASE}/`);
await j.getByText("Du bist dran").first().waitFor({ timeout: 15000 });
await j.evaluate(async () => { await navigator.serviceWorker.ready; });
await j.reload(); // now controlled by the service worker
await j.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
await j.context().setOffline(true);
await j.goto(`${BASE}/plan`).catch(() => {});
await j.getByText("Gerade offline").waitFor({ timeout: 10000 });
check("offline: friendly page instead of the browser error", true);
const imgOk = await j.evaluate(() => document.querySelector("img").naturalWidth > 0);
check("offline: logo comes from the cache", imgOk);
await j.screenshot({ path: `${OUT}m7-03-offline.png` });
await j.context().setOffline(false);
await j.getByText("Du bist dran").first().waitFor({ timeout: 15000 }).catch(() => {});
check("back online: reloads by itself", await j.getByText("Du bist dran").first().isVisible());

// 3) Manifest shortcuts
const manifest = await fetch(`${BASE}/manifest.webmanifest`).then((r) => r.json());
check(`manifest shortcuts (${manifest.shortcuts?.map((s) => s.url)})`, manifest.shortcuts?.length === 2 && manifest.id === "/");

// 4) Removed from the allowlist → session ends at once
await db.query("UPDATE users SET email = 'weg@example.com' WHERE id = $1", [sam.id]);
const s = await pageFor(sam.token);
await s.goto(`${BASE}/`);
await s.waitForURL(/\/login/, { timeout: 10000 }).catch(() => {});
check(`not allowed anymore → login (${new URL(s.url()).pathname})`, new URL(s.url()).pathname === "/login");
const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM sessions WHERE user_id = $1", [sam.id]);
check("her sessions are deleted", n === 0);

// 5) Tick cleans up expired sessions and old log rows
await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ('expired-x', $1, now() - interval '1 day')", [jonas.id]);
await db.query("INSERT INTO notification_log (user_id, type, ref_id, due_at) VALUES ($1, 'date_soon', 'old', now() - interval '100 days')", [jonas.id]);
await fetch(`${BASE}/api/cron/tick`, { method: "POST", headers: { Authorization: "Bearer test-cron-secret-123456" } });
const { rows: [c] } = await db.query("SELECT (SELECT count(*) FROM sessions WHERE id = 'expired-x')::int AS s, (SELECT count(*) FROM notification_log WHERE ref_id = 'old')::int AS l");
check(`tick clean-up (sessions ${c.s}, log ${c.l})`, c.s === 0 && c.l === 0);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
