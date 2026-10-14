// M1 end-to-end check: pairing flow with two (simulated) logged-in users.
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("TRUNCATE users, couples, sessions CASCADE");

async function makeUser(name, email) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name) VALUES ($1, $2, $3) RETURNING id",
    [`sub-${email}`, email, name],
  );
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [hash, rows[0].id]);
  return token;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function contextFor(token, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme });
  if (token) await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  return ctx;
}

let failures = 0;
function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}

const tokenA = await makeUser("Jonas", "jonas@example.com");
const tokenB = await makeUser("Sam", "partnerin@example.com");
const tokenC = await makeUser("Eve", "eve@example.com");

// Logged out → login page
const anon = await (await contextFor(null)).newPage();
await anon.goto(`${BASE}/`);
check("logged-out visitor lands on /login", anon.url().endsWith("/login"));
await anon.screenshot({ path: `${SHOTS}01-login.png` });

const garbage = await (await contextFor("garbage-token")).newPage();
await garbage.goto(`${BASE}/`);
await garbage.waitForURL("**/login", { timeout: 10000 }).catch(() => {});
check("invalid session cookie ends on /login", garbage.url().endsWith("/login"));

// A: no couple yet → /pair
const a = await (await contextFor(tokenA)).newPage();
await a.goto(`${BASE}/`);
await a.waitForURL("**/pair", { timeout: 10000 }).catch(() => {});
check("user without couple is sent to /pair", a.url().endsWith("/pair"));
await a.getByRole("button", { name: "Paar starten" }).waitFor();
await a.screenshot({ path: `${SHOTS}02-pair-start.png` });

// A starts a couple and gets a code
await a.getByRole("button", { name: "Paar starten" }).click();
const codeEl = a.getByText(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/);
await codeEl.waitFor({ timeout: 10000 });
const code = (await codeEl.textContent()).trim();
check(`invite code shown (${code})`, /^[A-Z2-9]{3}-[A-Z2-9]{3}$/.test(code));
await a.screenshot({ path: `${SHOTS}03-pair-code.png` });

// B: wrong format, then the real code typed sloppily
const b = await (await contextFor(tokenB)).newPage();
await b.goto(`${BASE}/pair`);
await b.getByLabel("Einladungscode").fill("ABC");
await b.getByRole("button", { name: "Beitreten" }).click();
await b.locator("#invite-code-error").waitFor();
check("short code shows a format hint", (await b.locator("#invite-code-error").textContent()).includes("6 Zeichen"));
await b.screenshot({ path: `${SHOTS}04-join-error.png` });

await b.getByLabel("Einladungscode").fill(` ${code.toLowerCase()} `);
await b.getByRole("button", { name: "Beitreten" }).click();
await b.waitForURL("**/welcome", { timeout: 10000 }).catch(() => {});
await b.getByRole("heading", { name: /^Willkommen, / }).waitFor({ timeout: 10000 }).catch(() => {});
check(`partner joins with lowercase code and sees the introduction (${b.url()})`, b.url().endsWith("/welcome"));
await b.waitForTimeout(1000); // let the page hydrate before swiping
await b.screenshot({ path: `${SHOTS}05a-welcome.png` });
for (let i = 0; i < 3; i++) {
  await b.getByRole("button", { name: "Weiter" }).click();
  await b.waitForTimeout(450);
}
await b.screenshot({ path: `${SHOTS}05b-welcome-last.png` });
await b.getByRole("button", { name: "Los geht's 🎉" }).click();
await b.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
await b.getByText("Dein nächster Schritt").waitFor({ timeout: 10000 }).catch(() => {});
check("after the intro: home with the next step (connect calendar)", b.url() === `${BASE}/` && (await b.getByRole("heading", { name: "Verbinde deinen Kalender" }).count()) === 1);
check("setup checklist shows what is missing", await b.getByText(/Startklar\? \d von \d/).isVisible());
await b.waitForTimeout(400);
await b.screenshot({ path: `${SHOTS}05-home.png`, fullPage: true });

// A's waiting screen notices the join by itself (→ intro), "Überspringen" works too
await a.waitForURL("**/welcome", { timeout: 15000 }).catch(() => {});
check("creator's pairing screen moves on automatically", a.url().endsWith("/welcome"));
await a.getByRole("button", { name: "Überspringen" }).click();
await a.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
const { rows: onboarded } = await db.query("SELECT count(*)::int AS n FROM users WHERE onboarded_at IS NOT NULL");
check(`both marked as introduced (${onboarded[0].n})`, onboarded[0].n === 2);
await a.goto(`${BASE}/`);
check("intro is not shown again", (await a.getByText("Dein nächster Schritt").waitFor({ timeout: 10000 }).then(() => true, () => false)) && a.url() === `${BASE}/`);

// A third person cannot use the (now deleted) code
const c = await (await contextFor(tokenC)).newPage();
await c.goto(`${BASE}/pair`);
await c.getByLabel("Einladungscode").fill(code);
await c.getByRole("button", { name: "Beitreten" }).click();
await c.locator("#invite-code-error").waitFor();
check("third person is rejected", (await c.locator("#invite-code-error").textContent()).includes("kennt der Date-O-Mat nicht"));
const { rows: members } = await db.query("SELECT count(*)::int AS n FROM users WHERE couple_id IS NOT NULL");
check("couple has exactly two members", members[0].n === 2);

// Dark mode screenshot
const dark = await (await contextFor(tokenB, "dark")).newPage();
await dark.goto(`${BASE}/`);
await dark.getByText("Diese Woche", { exact: true }).waitFor();
await dark.waitForTimeout(400);
await dark.screenshot({ path: `${SHOTS}06-home-dark.png` });

// Settings + logout
await a.goto(`${BASE}/settings`);
await a.getByRole("button", { name: "Abmelden" }).waitFor();
await a.screenshot({ path: `${SHOTS}07-settings.png` });
await a.getByRole("button", { name: "Abmelden" }).click();
await a.waitForURL("**/login", { timeout: 10000 }).catch(() => {});
check("logout returns to /login", a.url().endsWith("/login"));
await a.goto(`${BASE}/settings`);
check("after logout, settings redirect to /login", a.url().endsWith("/login"));
const { rows: sessionsLeft } = await db.query("SELECT count(*)::int AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = 'jonas@example.com'");
check("logout deleted the session row", sessionsLeft[0].n === 0);

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
