// M1 end-to-end check: pairing flow with two (simulated) logged-in users.
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium } from "playwright";
import { resetDb } from "./db.mjs";
import { stubPush } from "./push-stub.mjs";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions");

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
const aContext = await contextFor(tokenA);
await stubPush(aContext);
const a = await aContext.newPage();
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
const bContext = await contextFor(tokenB);
await stubPush(bContext);
const b = await bContext.newPage();
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
for (let i = 0; i < 4; i++) {
  await b.getByRole("button", { name: "Weiter" }).click();
  await b.waitForTimeout(450);
}
// The last card turns reminders on: "Später" is small, the big button only comes with push.
const pushCard = b.getByRole("heading", { name: "Damit ihr kein Date vergesst" });
check("last card of the introduction: reminders", await pushCard.isVisible());
check("…with a small \"Später\" and no big way out yet", (await b.getByRole("button", { name: "Später" }).isVisible()) && (await b.getByRole("button", { name: "Los geht's 🎉" }).count()) === 0);
await b.screenshot({ path: `${SHOTS}05b-welcome-last.png` });
await b.getByRole("button", { name: "🔔 Erinnerungen an" }).click();
await b.getByText("🔔 Erinnerungen sind an").waitFor({ timeout: 10000 });
const { rows: [pushed] } = await db.query("SELECT count(*)::int AS n FROM push_subscriptions s JOIN users u ON u.id = s.user_id WHERE u.email = 'partnerin@example.com'");
check(`one tap asks for permission and saves the device (${pushed.n})`, pushed.n === 1);
check("now the big \"Los geht's\" is there", await b.getByRole("button", { name: "Los geht's 🎉" }).isVisible());
await b.screenshot({ path: `${SHOTS}05c-welcome-push-on.png` });
await b.getByRole("button", { name: "Los geht's 🎉" }).click();
await b.waitForURL(`${BASE}/plan`, { timeout: 10000 }).catch(() => {});
await b.getByRole("heading", { name: "Verbinde deinen Google Kalender" }).waitFor({ timeout: 10000 }).catch(() => {});
check("after the intro: Date planen asks to connect the calendar", b.url() === `${BASE}/plan` && (await b.getByRole("heading", { name: "Verbinde deinen Google Kalender" }).count()) === 1);
check("setup checklist shows what is missing", await b.getByText(/^Startklar \d\/\d$/).isVisible());
await b.waitForTimeout(400);
await b.screenshot({ path: `${SHOTS}05-home.png`, fullPage: true });

// A's waiting screen notices the join by itself (→ intro), "Überspringen" works too
await a.waitForURL("**/welcome", { timeout: 15000 }).catch(() => {});
check("creator's pairing screen moves on automatically", a.url().endsWith("/welcome"));
await a.getByRole("button", { name: "Überspringen" }).click();
await a.waitForURL(`${BASE}/plan`, { timeout: 10000 }).catch(() => {});
const { rows: onboarded } = await db.query("SELECT count(*)::int AS n FROM users WHERE onboarded_at IS NOT NULL");
check(`both marked as introduced (${onboarded[0].n})`, onboarded[0].n === 2);
await a.goto(`${BASE}/`);
await a.waitForURL(`${BASE}/plan`, { timeout: 10000 }).catch(() => {});
check("intro is not shown again: / lands on Date planen", a.url() === `${BASE}/plan`);
const header = a.locator("header").first();
await a.getByRole("heading", { name: "Date planen" }).waitFor({ timeout: 15000 });
const bar = a.getByRole("navigation", { name: "Hauptmenü" });
check("bottom bar: Beet · Ideen · Swipen · Archiv · Einstellungen", (await bar.getByRole("link").evaluateAll((l) => l.map((x) => x.getAttribute("aria-label")))).join("|") === "Beet|Ideen|Swipen|Archiv|Einstellungen");
await header.getByRole("link", { name: "Date-O-Mat – zum Start" }).waitFor({ timeout: 15000 });
check("the header is only the name", (await header.getByRole("link").count()) === 1);

// Reminders: my own line stays until a device of mine is registered – one tap, no detour
const pushLine = a.getByText("Damit ihr kein Date vergesst: Erinnerungen an.");
await pushLine.waitFor({ timeout: 15000 });
check("start: a line asks for reminders, with a one-tap button", await a.getByRole("button", { name: "Aktivieren" }).isVisible());
check("…and it cannot be dismissed (only the button is in it)", (await a.locator("[role=note]").filter({ hasText: "Erinnerungen an" }).getByRole("button").count()) === 1);
await a.screenshot({ path: `${SHOTS}05d-push-row.png` });
await a.getByRole("button", { name: "Aktivieren" }).click();
await pushLine.waitFor({ state: "hidden", timeout: 10000 });
const { rows: [jonasPush] } = await db.query("SELECT count(*)::int AS n FROM push_subscriptions s JOIN users u ON u.id = s.user_id WHERE u.email = 'jonas@example.com'");
check(`one tap on the start registers the device and the line is gone (${jonasPush.n})`, jonasPush.n === 1);

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
// Sam says no to notifications: the start explains how to allow them again.
await db.query("DELETE FROM push_subscriptions");
const darkContext = await contextFor(tokenB, "dark");
await stubPush(darkContext, "denied");
const dark = await darkContext.newPage();
await dark.goto(`${BASE}/`);
await dark.getByRole("button", { name: "Aktivieren" }).click();
await dark.getByText("Erinnerungen sind blockiert.").waitFor({ timeout: 10000 });
await dark.getByRole("button", { name: "So erlaubst du sie" }).click();
check("denied: the start shows how to allow notifications again", await dark.locator("dialog[open]").getByText("Stelle „Benachrichtigungen“ auf „Zulassen“.").isVisible());
await dark.screenshot({ path: `${SHOTS}06b-push-denied-dark.png` });
await dark.keyboard.press("Escape");
await dark.getByRole("heading", { name: "Date planen" }).waitFor();
await dark.waitForTimeout(400);
await dark.screenshot({ path: `${SHOTS}06-home-dark.png` });

// Settings + logout
await a.goto(`${BASE}/settings`);
await a.getByRole("heading", { name: /setup/ }).waitFor();
await a.getByRole("radiogroup", { name: "Wer gießt?" }).waitFor({ timeout: 15000 });
await a.waitForTimeout(500);
await a.screenshot({ path: `${SHOTS}07-setup.png` });
check("setup shows the essentials: who plans, rhythm, deadline, reminders, calendars", (await a.getByRole("radiogroup", { name: "Wer gießt?" }).isVisible()) && (await a.getByLabel("Rhythmus", { exact: true }).isVisible()) && (await a.getByRole("switch", { name: "Push-Erinnerung" }).isVisible()) && (await a.getByText("Freie Abende ab").isVisible()));
await a.getByRole("link", { name: /^Mehr/ }).click();
await a.getByRole("navigation", { name: "Themen" }).waitFor();
check("\"Mehr\" is a list of the other topics", (await a.getByRole("navigation", { name: "Themen" }).getByRole("link").count()) >= 8);
await a.screenshot({ path: `${SHOTS}07-settings-menu.png` });
await a.getByRole("link", { name: /Ihr zwei & Konto/ }).click();
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
