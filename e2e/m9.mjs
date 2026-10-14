// M9: photos – upload (resized in the browser, EXIF gone), private serving, lightbox, delete, cover.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const ZONE = "Europe/Berlin";
const OUT = new URL("./shots/", import.meta.url).pathname;
const FIX = new URL("./fixtures/", import.meta.url).pathname;
const DATA = new URL("../.data/photos", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("TRUNCATE users, couples, sessions, ideas CASCADE");
async function makeCouple() {
  const { rows: [c] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
  return c.id;
}
async function makeUser(coupleId, name, email, color, createdAt) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
    [`sub-${email}`, email, name, coupleId, color, createdAt],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  return { id: rows[0].id, token };
}
const couple = await makeCouple();
const jonas = await makeUser(couple, "Jonas", "jonas@example.com", "mandarine", "2026-01-01");
await makeUser(couple, "Sam", "partnerin@example.com", "himmel", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id) VALUES ($1, $2)", [couple, jonas.id]);
const other = await makeCouple();
const eve = await makeUser(other, "Eve", "eve@example.com", "himmel", "2026-01-03");

const lastWeek = DateTime.now().setZone(ZONE).startOf("week").minus({ weeks: 1 });
const { rows: [c1] } = await db.query(
  `INSERT INTO cycles (couple_id, seq, starts_at, ends_at, deadline_at, mode, planner_id, status, closed_at)
   VALUES ($1, 1, $2, $3, $4, 'alternating', $5, 'done', now()) RETURNING id`,
  [couple, lastWeek.toJSDate(), lastWeek.plus({ weeks: 1 }).toJSDate(), lastWeek.plus({ days: 3 }).toJSDate(), jonas.id],
);
const start = lastWeek.plus({ days: 5 }).set({ hour: 12 });
const { rows: [d1] } = await db.query(
  `INSERT INTO date_plans (couple_id, cycle_id, title, size, location, starts_at, ends_at, organizer_id, proposed_by_id, status, sync_status)
   VALUES ($1, $2, 'Tag am Rhein', 'large', 'Rodenkirchen', $3, $4, $5, $5, 'done', 'synced') RETURNING id`,
  [couple, c1.id, start.toJSDate(), start.plus({ hours: 6 }).toJSDate(), jonas.id],
);

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

// 1) Upload two big photos
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/dates/${d1.id}`);
await j.getByRole("button", { name: "📷 Fotos hinzufügen" }).waitFor({ timeout: 15000 });
await j.screenshot({ path: `${OUT}m9-01-empty.png`, fullPage: true });
await j.locator("#photo-input").setInputFiles([`${FIX}strand.jpg`, `${FIX}eis.jpg`]);
await j.locator('img[alt="Foto 2"]').waitFor({ timeout: 30000 });
const { rows: photos } = await db.query("SELECT id, width, height, bytes, full_path, thumb_path FROM date_photos ORDER BY created_at");
check(`two photos stored (${photos.map((p) => `${p.width}x${p.height}`)})`, photos.length === 2);
check("resized to max 1600 px, orientation kept", photos[0].width === 1600 && photos[0].height === 1200 && photos[1].width === 1200 && photos[1].height === 1600);
check(`small files (${photos.map((p) => Math.round(p.bytes / 1024) + " KB")})`, photos.every((p) => p.bytes < 600 * 1024));
check("paths are per couple and random", photos.every((p) => p.full_path.startsWith(`couples/${couple}/dates/${d1.id}/`)));
const stored = readFileSync(`${DATA}/${photos[0].full_path}`);
check("EXIF metadata removed by re-encoding", !stored.includes("SECRET-GPS-MARKER") && !stored.includes("TestCam"));

// 2) Private serving
const res = await j.request.get(`${BASE}/api/photos/${photos[0].id}`);
check(`owner gets the photo (${res.status()} ${res.headers()["content-type"]})`, res.status() === 200 && res.headers()["content-type"] === "image/jpeg");
check(`private, long cache, sandboxed (${res.headers()["cache-control"]})`, res.headers()["cache-control"].startsWith("private") && /sandbox/.test(res.headers()["content-security-policy"]));
const thumb = await j.request.get(`${BASE}/api/photos/${photos[0].id}?size=thumb`);
check(`thumbnail is smaller (${(await thumb.body()).length} bytes)`, (await thumb.body()).length < (await res.body()).length / 2);
const anon = await (await pageFor(null)).request.get(`${BASE}/api/photos/${photos[0].id}`, { maxRedirects: 0 });
check(`without login: ${anon.status()}`, anon.status() === 401);
const e = await pageFor(eve.token);
const foreign = await e.request.get(`${BASE}/api/photos/${photos[0].id}`);
check(`other couple: ${foreign.status()}`, foreign.status() === 404);

// 3) Not an image
await j.locator("#photo-input").setInputFiles([`${FIX}fake.jpg`]);
await j.getByText("„fake.jpg“ konnte nicht gelesen werden.").waitFor({ timeout: 10000 });
check("a non-image is refused with a message", (await db.query("SELECT count(*)::int AS c FROM date_photos")).rows[0].c === 2);

// 4) Lightbox, next, delete
await j.reload();
await j.locator('img[alt="Foto 1"]').click();
await j.getByRole("dialog").locator('img[alt="Foto 1 von 2"]').waitFor({ timeout: 10000 });
await j.waitForFunction(() => document.querySelector('dialog img')?.naturalWidth > 0);
await j.screenshot({ path: `${OUT}m9-02-lightbox.png` });
await j.getByRole("button", { name: "Nächstes Foto" }).click();
await j.getByRole("dialog").locator('img[alt="Foto 2 von 2"]').waitFor();
check("lightbox: next photo", true);
await j.getByRole("button", { name: "Löschen" }).click();
await j.getByRole("button", { name: "Wirklich löschen" }).click();
await j.locator('img[alt="Foto 2"]').waitFor({ state: "detached", timeout: 10000 });
const left = await db.query("SELECT count(*)::int AS c FROM date_photos");
check(`deleted (${left.rows[0].c} left), files gone`, left.rows[0].c === 1 && !existsSync(`${DATA}/${photos[1].full_path}`) && !existsSync(`${DATA}/${photos[1].thumb_path}`));
await j.screenshot({ path: `${OUT}m9-03-detail.png`, fullPage: true });

// 5) Cover on the list (also for the partner), dark mode
const sd = await pageFor((await db.query("SELECT 1")).rows && (await (async () => { const t = randomBytes(32).toString("base64url"); const { rows: [sam] } = await db.query("SELECT id FROM users WHERE name = 'Sam'"); await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(t).digest("hex"), sam.id]); return t; })()), "dark");
await sd.goto(`${BASE}/dates`);
await sd.locator(`img[src="/api/photos/${photos[0].id}?size=thumb"]`).waitFor({ timeout: 15000 });
await sd.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
check("partner sees the cover photo on the list", true);
await sd.screenshot({ path: `${OUT}m9-04-list-dark.png`, fullPage: true });

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
