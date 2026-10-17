// M3 end-to-end check: calendar connection states, slot finder, calendar + slot settings.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import pg from "pg";
import { chromium } from "playwright";
import { customIdea } from "./flow.mjs";
import { DAYS, requests, startMock } from "./google-mock.mjs";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");

function encrypt(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

const mock = await startMock(4010);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("TRUNCATE users, couples, sessions, ideas CASCADE");
const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
await db.query("INSERT INTO couple_settings (couple_id) VALUES ($1)", [couple.id]);

async function makeUser(name, email, color) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, onboarded_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [
    createHash("sha256").update(token).digest("hex"),
    rows[0].id,
  ]);
  return { id: rows[0].id, token };
}
async function connect(user, accessToken, calendars) {
  await db.query(
    `INSERT INTO google_connections (user_id, refresh_token_enc, access_token_enc, access_token_expires_at, scopes, busy_calendar_ids)
     VALUES ($1, $2, $3, now() + interval '1 hour', '{}', $4)`,
    [user.id, encrypt("fake-refresh"), encrypt(accessToken), calendars],
  );
}

const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel");

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  return ctx.newPage();
}
let failures = 0;
function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}
const ZONE = "Europe/Berlin";

/** Reads all free times (three per page) as {weekday, day, time, text}. */
async function readSlots(page) {
  // The free times are step 2 – without a wishlist, your own idea leads there.
  const stepOne = page.getByRole("heading", { name: "Was wollt ihr machen?" });
  await page.locator("ol li").or(stepOne).first().waitFor({ timeout: 15000 });
  if (await stepOne.isVisible()) await customIdea(page, "Spazieren gehen");
  await page.locator("ol li").first().waitFor({ timeout: 10000 });
  const slots = [];
  for (let i = 0; i < 10; i++) {
    slots.push(
      ...(await page.locator("ol li").evaluateAll((items) =>
        items.map((li) => {
          const spans = li.querySelectorAll("span span");
          const time = li.querySelector(".font-display.text-lg")?.textContent ?? "";
          return { weekday: spans[0]?.textContent, day: spans[1]?.textContent, time, text: li.textContent };
        }),
      )),
    );
    const more = page.getByRole("button", { name: "Weitere Zeiten →" });
    if (!(await more.isVisible())) break;
    await more.click();
  }
  return slots;
}

const j = await pageFor(jonas.token);

// 1) Nobody connected
await j.goto(`${BASE}/plan`);
await j.getByRole("link", { name: "Kalender verbinden" }).waitFor({ timeout: 10000 });
check("plan page asks me to connect my calendar", true);
check("connect link starts the calendar OAuth flow", (await j.getByRole("link", { name: "Kalender verbinden" }).getAttribute("href")) === "/api/auth/google?flow=calendar&next=%2Fplan");
await j.screenshot({ path: `${SHOTS}m3-01-connect.png` });

// 2) Only Jonas connected → partner hint
await connect(jonas, "token-jonas", ["primary", "uni123@import.calendar.google.com"]);
await j.reload();
await j.getByText("Sam muss den Kalender noch verbinden").waitFor({ timeout: 10000 });
check("with only one calendar, the partner hint shows", true);
await j.goto(`${BASE}/`);
await j.waitForURL(`${BASE}/plan`, { timeout: 10000 }).catch(() => {});
check("/ lands on Date planen, which says Sam still has to connect", (await j.getByText("Sam muss den Kalender noch verbinden").count()) === 1);

// 3) Both connected → slots
await connect(sam, "token-sam", ["primary"]);
requests.length = 0;
await j.goto(`${BASE}/plan`);
const small = await readSlots(j);
check(`small slots found (${small.length})`, small.length > 0 && small.length <= 5);
check("first slot is the Top-Tipp", small[0].text.includes("Top-Tipp"));
const fb = requests.filter((r) => r.url === "/calendar/v3/freeBusy");
check("FreeBusy was asked for both partners", fb.length === 2);
check("Jonas' query includes the subscribed uni calendar", fb.some((r) => r.token === "token-jonas" && r.body.items.some((i) => i.id.startsWith("uni123"))));
check("no slot on Saturday (Sam is busy all day)", !small.some((s) => s.day === String(DAYS.saturday.day) && s.weekday === "Sa"));
const fri = small.find((s) => s.weekday === "Fr" && s.day === String(DAYS.friday.day));
if (fri) {
  const start = Number(fri.time.slice(0, 2)) * 60 + Number(fri.time.slice(3, 5));
  check(`Friday slot (${fri.time}) starts after Jonas' busy block + buffer (17:30)`, start >= 17 * 60 + 30);
} else if (DAYS.friday > DateTime.now().setZone(ZONE).endOf("week")) {
  // On Fridays and weekends "next Friday" is in the next round – not searched by default.
  console.log("  (next Friday is in the next round – fine)");
} else check("Friday slot present", false);
const wed = small.find((s) => s.weekday === "Mi" && s.day === String(DAYS.wednesday.day));
if (wed) {
  const [from, to] = wed.time.split(" – ").map((t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
  check(`Wednesday slot (${wed.time}) avoids the uni block 17:30–22:00`, to <= 17 * 60 + 30 || from >= 22 * 60);
} else console.log("  (no Wednesday slot in the top 5 – fine)");
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m3-02-small.png` });

await j.getByRole("button", { name: /Lang/ }).click();
const large = await readSlots(j);
check(`large slots found (${large.length})`, large.length > 0);
check("large slots show their length", large.every((s) => /Std\./.test(s.text)));
check("no large slot on Saturday", !large.some((s) => s.weekday === "Sa" && s.day === String(DAYS.saturday.day)));
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m3-03-large.png` });

// 4) Settings: calendar list + selection
await j.goto(`${BASE}/settings?t=kalender`);
const uni = j.getByRole("checkbox", { name: /Uni-Stundenplan/ });
await uni.waitFor({ timeout: 10000 });
check("subscribed calendar is listed and selected", await uni.isChecked());
check("holiday calendar is listed but not selected", !(await j.getByRole("checkbox", { name: /Feiertage/ }).isChecked()));
check("primary calendar is always on", (await j.getByRole("checkbox", { name: /Hauptkalender/ }).isDisabled()) && (await j.getByRole("checkbox", { name: /Hauptkalender/ }).isChecked()));
check("partner status is shown", (await j.getByText("Sam: verbunden ✓").count()) === 1);
await j.screenshot({ path: `${SHOTS}m3-04-settings-calendar.png`, fullPage: false });
await uni.uncheck();
await j.getByRole("button", { name: "Auswahl speichern" }).click();
await j.getByText("Auswahl gespeichert.").waitFor({ timeout: 10000 });
const { rows: [conn] } = await db.query("SELECT busy_calendar_ids FROM google_connections WHERE user_id = $1", [jonas.id]);
check("calendar selection saved (only primary)", JSON.stringify(conn.busy_calendar_ids) === '["primary"]');

// 5) Slot settings (a topic of their own)
await j.goto(`${BASE}/settings`);
await j.getByRole("navigation", { name: "Themen" }).waitFor({ timeout: 10000 });
check("advanced slot settings are a screen of their own", !(await j.getByLabel("Suchen für").isVisible()));
await j.getByRole("link", { name: /Freie Zeiten finden/ }).click();
const form = j.locator("form").filter({ has: j.getByLabel("Suchen für") });
await form.getByLabel("Suchen für").selectOption("7");
await form.getByLabel("Puffer um Termine").selectOption("0");
await form.getByRole("button", { name: "Speichern" }).click();
await j.getByText("Gespeichert ✓").waitFor({ timeout: 10000 });
const { rows: [settings] } = await db.query("SELECT horizon_days, buffer_minutes FROM couple_settings WHERE couple_id = $1", [couple.id]);
check("slot settings saved", settings.horizon_days === 7 && settings.buffer_minutes === 0);
await j.waitForTimeout(500);
check("form shows the saved values afterwards", (await form.getByLabel("Suchen für").inputValue()) === "7" && (await form.getByLabel("Puffer um Termine").inputValue()) === "0");
await form.getByLabel("Start frühestens").first().fill("22:00");
await form.getByRole("button", { name: "Speichern" }).click();
await j.getByText("„Spätestens“ muss nach „frühestens“ liegen.").waitFor({ timeout: 10000 });
check("invalid time window is rejected", true);
check("the invalid input stays visible next to the error", (await form.getByLabel("Start frühestens").first().inputValue()) === "22:00");
await form.scrollIntoViewIfNeeded();
await j.screenshot({ path: `${SHOTS}m3-05-settings-slots.png` });

await j.goto(`${BASE}/plan?later=1`);
await readSlots(j);
const untilText = await j.getByText(/^Gesucht bis/).textContent();
const expectedUntil = DateTime.now().setZone(ZONE).plus({ days: 7 }).setLocale("de").toFormat("d.");
check(`horizon of 7 days is used (${untilText})`, untilText.includes(` ${expectedUntil} `));

// 6) Revoked access → reconnect prompt
await db.query("UPDATE google_connections SET status = 'needs_reauth' WHERE user_id = $1", [sam.id]);
const s = await pageFor(sam.token);
await s.goto(`${BASE}/plan`);
await s.getByText("Bitte verbinde deinen Kalender neu").waitFor({ timeout: 10000 });
check("revoked calendar asks for reconnection", true);

// 7) Invalid access token (Google answers 401) → app tries a refresh, then shows a friendly error
await db.query("UPDATE google_connections SET status = 'ok', access_token_enc = $2 WHERE user_id = $1", [sam.id, encrypt("token-broken")]);
// The start page no longer asks Google – the free times (step 2) do.
await s.goto(`${BASE}/plan`);
await s.getByRole("button", { name: "Was anderes …" }).click({ timeout: 20000 });
await s.locator("dialog[open]").getByLabel("Eure eigene Idee").fill("Spazieren gehen");
await s.locator("dialog[open]").getByRole("button", { name: "Weiter →" }).click();
await s.getByText(/Google Kalender antwortet gerade nicht|Ein Kalender ist nicht mehr verbunden|Bitte verbinde deinen Kalender neu|muss den Kalender neu verbinden/).first().waitFor({ timeout: 20000 });
check("rejected token leads to a friendly message, not a crash", true);

// 8) Disconnect
await j.goto(`${BASE}/settings?t=kalender`);
await j.getByRole("button", { name: "Verbindung trennen" }).click();
await j.getByText("Kalender getrennt.").waitFor({ timeout: 15000 });
const { rows: left } = await db.query("SELECT count(*)::int AS n FROM google_connections WHERE user_id = $1", [jonas.id]);
check("disconnect deletes the stored tokens", left[0].n === 0);

const dark = await pageFor(sam.token, "dark");
await db.query("UPDATE google_connections SET access_token_enc = $2 WHERE user_id = $1", [sam.id, encrypt("token-sam")]);
await connect(jonas, "token-jonas", ["primary"]);
await dark.goto(`${BASE}/plan`);
await readSlots(dark);
await dark.waitForTimeout(300);
await dark.screenshot({ path: `${SHOTS}m3-06-small-dark.png` });

await browser.close();
await db.end();
mock.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
