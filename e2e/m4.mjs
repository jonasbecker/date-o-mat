// M4 end-to-end check: rounds, turns, modes, cron tick, dev clock over several rounds.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium } from "playwright";
import { startMock } from "./google-mock.mjs";
import { tuesdayMorningOffset } from "./clock.mjs";
import { fitsScreen, openTimes } from "./flow.mjs";
import { resetDb } from "./db.mjs";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "base64");
const encrypt = (text) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return ["v1", iv, c.getAuthTag(), ct].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
};

const mock = await startMock(4010);
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
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset()]);
for (const [title, size, day] of [["Picknick im Stadtwald", "small", 3], ["Ramen kochen", "small", 1], ["Wandern", "large", 2]]) {
  await db.query("INSERT INTO ideas (couple_id, title, size, created_by_id, created_at) VALUES ($1, $2, $3, $4, now() - ($5 || ' days')::interval)", [couple.id, title, size, jonas.id, day]);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  return ctx.newPage();
}
let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
// The state of the round sits on top of "Date planen" (where / lands without a date).
const heading = async (page) => {
  await page.locator("[data-next-step] h2").first().waitFor({ timeout: 15000 }).catch(() => {});
  return ((await page.locator("[data-next-step] h2").first().textContent()) ?? "").replace(/\s+/g, " ").trim();
};
const cyclesInDb = async () =>
  (await db.query("SELECT seq, status, mode, planner_id, starts_at, ends_at, deadline_at FROM cycles WHERE couple_id = $1 ORDER BY seq", [couple.id])).rows;

const j = await pageFor(jonas.token);
const s = await pageFor(sam.token);

// Round 1 – Jonas starts
await j.goto(`${BASE}/`);
await heading(j);
check("round 1 is created on first visit", /^Diese Woche: Frist /.test((await j.locator("[data-next-step] [data-week-bar]").getAttribute("aria-label")) ?? ""));
check(`Jonas sees "Du bist dran!" (${await heading(j)})`, (await heading(j)) === "du bist dran.");
check("time left big on the right, until the deadline", /noch[\s\S]*\d+\s*(h|Tage)[\s\S]*bis \w+, \d+(:\d\d)? Uhr/.test(await j.locator("[data-deadline]").innerText()));
check("/ lands on Date planen", j.url() === `${BASE}/plan`);
check("one 'Date planen' button, inside the card", (await j.getByRole("link", { name: "Date planen", exact: true }).count()) === 1 && (await j.locator("[data-next-step]").getByRole("link", { name: "Date planen", exact: true }).count()) === 1);
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m4-01-my-turn.png` });
const [c1] = await cyclesInDb();
const len1 = (c1.ends_at - c1.starts_at) / 86_400_000;
check(`weekly round lasts 7 days (${len1})`, Math.round(len1) === 7);

await s.goto(`${BASE}/`);
check(`Sam sees "Jonas ist dran" (${await heading(s)})`, (await heading(s)) === "jonas ist dran.");
await s.waitForTimeout(300);
await s.screenshot({ path: `${SHOTS}m4-02-partner-turn.png` });

// Swap
await s.getByRole("button", { name: "Ich übernehme diesmal" }).click();
await s.getByRole("heading", { name: "du bist dran." }).waitFor({ timeout: 10000 });
check("Sam can take over the round", true);
await j.reload();
check("…and Jonas now sees Sam's turn", (await heading(j)) === "sam ist dran.");
await j.getByRole("button", { name: "Ich übernehme diesmal" }).click();
await j.getByRole("heading", { name: "du bist dran." }).waitFor({ timeout: 10000 });

// Cron endpoint
const r0 = await fetch(`${BASE}/api/cron/tick`, { method: "POST" });
const r1 = await fetch(`${BASE}/api/cron/tick`, { method: "POST", headers: { Authorization: "Bearer wrong-secret-wrong-secret" } });
const r2 = await fetch(`${BASE}/api/cron/tick`, { method: "POST", headers: { Authorization: "Bearer test-cron-secret-123456" } });
const body = await r2.json();
check(`cron tick rejects missing/wrong secret (${r0.status}, ${r1.status})`, r0.status === 401 && r1.status === 401);
check(`cron tick runs with the secret (${JSON.stringify(body)})`, r2.status === 200 && body.ok && body.couples === 1);

// Dev clock: one week later → round 2, Sam's turn, round 1 skipped
const offsetBefore = (await db.query("SELECT dev_clock_offset_minutes AS o FROM couple_settings WHERE couple_id = $1", [couple.id])).rows[0].o;
await j.goto(`${BASE}/settings?t=konto`);
await j.getByRole("button", { name: "+1 Woche" }).click();
await j.getByText(`verstellt um ${Math.round((offsetBefore + 7 * 24 * 60) / 60)} Std`).waitFor({ timeout: 10000 });
await j.goto(`${BASE}/`);
check(`round 2 is Sam's (${await heading(j)})`, (await heading(j)) === "sam ist dran.");
check("the flower is sad and says the round was missed (thought bubble)", (await j.locator('[data-next-step] [data-bloom="traurig"]').count()) === 1 && /letztes mal fiel's aus/.test(await j.locator("[data-next-step] [data-speech]").innerText()));
await j.screenshot({ path: `${SHOTS}m4-skipped-note.png` });
check("the Beet has a wilted leaf for the missed round", (await j.locator('[data-next-step] [data-leaf="wilted"]').count()) === 1);
check("one week later: round 2", (await cyclesInDb()).at(-1).seq === 2);
await j.goto(`${BASE}/dates`);
await j.locator("[data-wilted]").first().waitFor({ timeout: 10000 }).catch(() => {});
check("the Archiv shows the missed round as a wilted tile", (await j.locator("[data-wilted]").count()) === 1 && (await j.getByText("kein Date – das Blatt ist welk").isVisible()));
await j.goto(`${BASE}/`);
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m4-03-missed.png` });

// Two more weeks via the cron tick only (no page view in between)
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = dev_clock_offset_minutes + 2 * 7 * 24 * 60 WHERE couple_id = $1", [couple.id]);
await fetch(`${BASE}/api/cron/tick`, { headers: { Authorization: "Bearer test-cron-secret-123456" } });
let rows = await cyclesInDb();
check(`the tick created the rounds by itself (${rows.length} rounds)`, rows.length === 4);
check("finished rounds without a date are skipped", rows.slice(0, 3).every((r) => r.status === "skipped"));
check("turns alternate J, S, J, S", rows.map((r) => (r.planner_id === jonas.id ? "J" : "S")).join("") === "JSJS");
check("rounds are seamless (end = next start)", rows.slice(1).every((r, i) => r.starts_at.getTime() === rows[i].ends_at.getTime()));

// Rhythm → every 2 weeks: current round unchanged, next one 2 weeks
await j.goto(`${BASE}/settings`);
await j.getByLabel("Rhythmus", { exact: true }).waitFor({ timeout: 15000 });
await j.waitForTimeout(800);
await j.getByLabel("Rhythmus", { exact: true }).selectOption("biweekly");
check("deadline suggestion follows the rhythm (5 days)", (await j.getByLabel("Plan bis … (Frist)").inputValue()) === "5");
// Every control saves by itself.
await j.locator("form").filter({ has: j.getByLabel("Rhythmus", { exact: true }) }).getByText("✓").waitFor({ timeout: 10000 });
await j.screenshot({ path: `${SHOTS}m4-04-settings.png` });
rows = await cyclesInDb();
check("current round keeps its end after a rhythm change", Math.round((rows[3].ends_at - rows[3].starts_at) / 86_400_000) === 7);
await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = dev_clock_offset_minutes + 7 * 24 * 60 WHERE couple_id = $1", [couple.id]);
await j.goto(`${BASE}/`);
await j.waitForURL(`${BASE}/plan`, { timeout: 15000 }).catch(() => {});
rows = await cyclesInDb();
check(`next round is two weeks long (${Math.round((rows[4].ends_at - rows[4].starts_at) / 86_400_000)} days)`, Math.round((rows[4].ends_at - rows[4].starts_at) / 86_400_000) === 14);
check("round 5 belongs to Jonas", rows[4].planner_id === jonas.id);

// Suggestion mode – applies to the open round right away
await j.goto(`${BASE}/settings`);
// CI once never showed the form here – say what was on screen, then load once more.
const modeChoice = j.getByText("Vorschlag", { exact: true });
if (!(await modeChoice.waitFor({ timeout: 15000 }).then(() => true, () => false))) {
  console.log("DEBUG settings", j.url(), (await j.locator("main").innerText().catch(() => "")).slice(0, 600));
  await j.screenshot({ path: `${SHOTS}m4-debug-settings.png` });
  await j.reload();
}
await j.waitForTimeout(800);
await modeChoice.click();
await j.locator("form").filter({ has: j.getByLabel("Rhythmus", { exact: true }) }).getByText("✓").waitFor({ timeout: 10000 });
rows = await cyclesInDb();
check("open round switched to suggestion mode immediately", rows.at(-1).mode === "suggestion" && rows.at(-1).planner_id === null);
await j.goto(`${BASE}/`);
await j.getByText("Der Date-O-Mat schlägt vor").waitFor({ timeout: 15000 });
// The proposal sits inside the step card.
const first = await j.locator("[data-next-step] [data-suggestion] p.font-display").filter({ visible: true }).first().textContent();
check(`a suggestion with an idea is shown (${first})`, ["Picknick im Stadtwald", "Ramen kochen", "Wandern"].includes(first));
await j.waitForTimeout(300);
await j.screenshot({ path: `${SHOTS}m4-05-suggestion.png` });
check("open proposal: no swipe deck on the Beet (it has its own tab)", (await j.locator("[data-swipe-deck]").count()) === 0);
check("the proposal state fits the screen", await fitsScreen(j));
const before = (await db.query("SELECT starts_at, idea_id FROM suggestions WHERE status = 'pending'")).rows[0];
await s.goto(`${BASE}/`);
await s.getByText("Der Date-O-Mat schlägt vor").waitFor({ timeout: 15000 });
const samSees = await s.locator("[data-next-step] [data-suggestion] p.font-display").filter({ visible: true }).first().textContent();
check("both partners see the same suggestion", samSees === first);
await j.getByRole("button", { name: "Anderer Vorschlag" }).click();
await j.waitForTimeout(1500);
const after = (await db.query("SELECT starts_at, idea_id FROM suggestions WHERE status = 'pending'")).rows[0];
check("'Anderer Vorschlag' brings a different slot", after && after.starts_at.getTime() !== before.starts_at.getTime());
check("…and a different idea", after && after.idea_id !== before.idea_id);

// Plan page is limited to the round ("Selbst aussuchen" next to the proposal)
await j.goto(`${BASE}/plan`);
await j.getByRole("link", { name: "Selbst aussuchen →" }).click();
await j.getByText(/^Diese[r]? .+ · der Date-O-Mat schlägt vor$/).waitFor({ timeout: 15000 });
check("plan page shows the round", true);
await openTimes(j, BASE, "?self=1");
check("plan page offers searching after the round", (await j.getByRole("link", { name: "Auch danach suchen" }).count()) === 1);

// Dark mode home
const dark = await pageFor(sam.token, "dark");
await db.query("UPDATE couple_settings SET mode = 'alternating' WHERE couple_id = $1", [couple.id]);
await dark.goto(`${BASE}/settings?t=konto`);
await dark.getByRole("button", { name: "Zurücksetzen" }).click();
await dark.waitForTimeout(1500);
await dark.goto(`${BASE}/`);
await dark.waitForTimeout(500);
await dark.screenshot({ path: `${SHOTS}m4-06-dark.png` });

await browser.close();
await db.end();
mock.close();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
