// M17: "Entdecken" – swipe deck made by (fake) Claude, matches, undo, super-like, combos, nudges.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createServer } from "node:http";
import pg from "pg";
import { chromium } from "playwright";
import { tuesdayMorningOffset } from "./clock.mjs";
import { startMock } from "./google-mock.mjs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
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
// Tuesday 12:00 of this week: nudges are not held back by quiet hours, events lie ahead.
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset() + 120]);
await db.query("INSERT INTO ideas (couple_id, title, size, created_by_id) VALUES ($1, 'Picknick im Stadtwald', 'small', $2)", [couple.id, jonas.id]);
const { rows: [source] } = await db.query("INSERT INTO event_sources (couple_id, url, label, kind) VALUES ($1, 'https://example.com/events', 'Test-Events', 'calendar') RETURNING id", [couple.id]);
for (const [title, days, venue] of [["Konzert: Annenmaykantereit", 8, "Palladium"], ["Lesung im Literaturhaus", 9, "Literaturhaus"]]) {
  await db.query(
    "INSERT INTO events (couple_id, source_id, kind, title, starts_at, venue, url, dedupe_key) VALUES ($1, $2, 'event', $3, date_trunc('day', now()) + ($4 || ' days')::interval + interval '18 hours', $5, 'https://example.com/e', $6)",
    [couple.id, source.id, title, days, venue, `key-${title}`],
  );
}

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failures++; };

// --- fake Claude: as many cards as asked for, combos for the listed events ------------------------
const NOUNS = ["Ramen", "Bouldern", "Kino", "Töpfern", "Rheinufer", "Spieleabend", "Museum", "Karaoke", "Minigolf", "Flohmarkt", "Sternwarte", "Kochkurs", "Lasertag", "Weinprobe", "Escape-Room", "Tretboot", "Theater", "Bowling", "Zoo", "Therme"];
const claudeCalls = [];
const claude = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const request = JSON.parse(body);
    claudeCalls.push(request);
    const n = claudeCalls.length;
    const prompt = request.messages[0].content;
    const ideas = Number(/Make (\d+) normal ideas/.exec(prompt)?.[1] ?? 0);
    const combos = Number(/Also make (\d+) combo cards/.exec(prompt)?.[1] ?? 0);
    const themes = ["food", "nature", "culture", "active", "creative", "cozy"];
    const cards = [{ title: "Stadtwald: Picknick", description: "Schon auf der Liste.", emoji: "🧺", size: "small", cost_eur: 5, location: "Stadtwald", setting: "outdoor", theme: "nature", wildcard: false, event_index: null, best_season: "any" }];
    for (let i = 0; i < ideas; i++) {
      cards.push({
        title: `${NOUNS[i % NOUNS.length]} Runde${n}`,
        description: `Beschreibung ${i + 1}`,
        emoji: ["🍜", "🧗", "🎬", "🏺", "🌊", "🎲", "🖼️", "🎤"][i % 8],
        size: i % 4 === 0 ? "large" : "small",
        cost_eur: i % 3 === 0 ? 0 : 10 + i,
        location: i % 2 === 0 ? "Ehrenfeld" : null,
        setting: i % 2 === 0 ? "indoor" : "outdoor",
        theme: themes[i % themes.length],
        wildcard: i % 4 === 3,
        event_index: null,
        best_season: "any",
      });
    }
    for (let i = 0; i < combos; i++) {
      cards.push({ title: `Kombi${n}x${i + 1}: Event und Burger`, description: "Vorher Burger um die Ecke.", emoji: "🎟️", size: "small", cost_eur: 60, location: "Mülheim", setting: "indoor", theme: "night", wildcard: false, event_index: i, best_season: "any" });
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      id: "msg_test", type: "message", role: "assistant", model: request.model,
      content: [{ type: "text", text: JSON.stringify({ cards }) }],
      stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 2000, output_tokens: 1500 },
    }));
  });
});
await new Promise((r) => claude.listen(4030, r));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}
const topCard = (p) => p.locator('[aria-roledescription="Karte"]');
const topTitle = async (p) => (await topCard(p).getAttribute("aria-label")) ?? "";
async function nextTop(p, before) {
  for (let i = 0; i < 40 && (await topTitle(p).catch(() => before)) === before; i++) await p.waitForTimeout(100);
  return topTitle(p);
}

// 1) Empty deck: the page orders a batch in the background, the cards arrive by themselves
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/ideas/entdecken`);
await topCard(j).waitFor({ timeout: 30000 });
const { rows: cards } = await db.query("SELECT title, kind, event_title, batch FROM deck_cards WHERE couple_id = $1", [couple.id]);
check(`a batch of 20 cards (${cards.length}, ${cards.filter((c) => c.kind === "combo").length} combos)`, cards.length === 20 && cards.filter((c) => c.kind === "combo").length === 2);
check("wishlist duplicate filtered out", !cards.some((c) => /Picknick/.test(c.title)));
const call = claudeCalls[0];
const prompt = call?.messages[0].content ?? "";
check(`model + schema (${call?.model})`, call?.model === "claude-haiku-5-5" && call?.output_config?.format?.type === "json_schema");
check("prompt: season, events, exclude list, wildcards", /\((spring|summer|autumn|winter)\)/.test(prompt) && prompt.includes("0: Konzert: Annenmaykantereit") && prompt.includes("Exclude list (already seen or on their list): Picknick im Stadtwald") && prompt.includes("wildcards"));
check("prompt: no names or e-mails", !/Jonas|Sam|example\.com/.test(prompt + call.system));
await j.screenshot({ path: `${OUT}m17-01-deck.png` });

// 2) Swipe with buttons, keyboard and a drag
await j.waitForTimeout(800); // hydration
const first = await topTitle(j);
await j.getByRole("button", { name: "Gefällt mir" }).click();
const second = await nextTop(j, first);
await j.keyboard.press("ArrowLeft");
const third = await nextTop(j, second);
await j.getByRole("button", { name: "Super-Like" }).click();
const fourth = await nextTop(j, third);
check(`super-like used up for today`, await j.getByRole("button", { name: "Super-Like" }).isDisabled());
const box = await topCard(j).boundingBox();
await j.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await j.mouse.down();
await j.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
await j.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 4 });
await j.mouse.up();
const fifth = await nextTop(j, fourth);
await j.waitForTimeout(500);
const swipes = async (userId) => (await db.query("SELECT c.title, s.verdict FROM deck_swipes s JOIN deck_cards c ON c.id = s.card_id WHERE s.user_id = $1 ORDER BY s.created_at", [userId])).rows;
let js = await swipes(jonas.id);
check(`swipes stored (${js.map((s) => s.verdict).join(",")})`, js.map((s) => `${s.title}:${s.verdict}`).join("|") === `${first}:like|${second}:nope|${third}:super|${fourth}:like`);
check("nope passes the card for both", (await db.query("SELECT status FROM deck_cards WHERE title = $1", [second])).rows[0].status === "passed");

// 3) Undo – twice: the drag-like and the super-like come back, the super-like is free again
await j.getByRole("button", { name: "Rückgängig" }).click();
check(`undo brings back the last card (${await nextTop(j, fifth)})`, (await topTitle(j)) === fourth);
await j.getByRole("button", { name: "Rückgängig" }).click();
check(`second undo (${await nextTop(j, fourth)})`, (await topTitle(j)) === third);
js = await swipes(jonas.id);
check("undone swipes are gone", js.length === 2);
await j.reload();
await topCard(j).waitFor({ timeout: 15000 });
await j.waitForTimeout(800);
check("super-like is available again", await j.getByRole("button", { name: "Super-Like" }).isEnabled());
await j.getByRole("button", { name: "Super-Like" }).click();
await j.waitForTimeout(600);
for (let i = 0; i < 3; i++) {
  const before = await topTitle(j);
  await j.getByRole("button", { name: "Gefällt mir" }).click();
  await nextTop(j, before);
}
await j.waitForTimeout(500);

// 4) Sam: Jonas' super-like first (with a star), then his likes – the passed card never shows
const s = await pageFor(sam.token);
await s.goto(`${BASE}/ideas/entdecken`);
await topCard(s).waitFor({ timeout: 15000 });
await s.waitForTimeout(800);
check(`Sam sees the super-like first (${await topTitle(s)})`, (await topTitle(s)) === third && (await topCard(s).getByText("⭐ Jonas findet das super").isVisible()));
const samTitles = await s.locator('[aria-roledescription="Karte"]').getAttribute("aria-label");
check("the passed card is gone for Sam", samTitles !== second);
await s.screenshot({ path: `${OUT}m17-02-super.png` });

// 5) Match: Sam likes Jonas' super-like → match overlay, wishlist idea
await s.getByRole("button", { name: "Gefällt mir" }).click();
await s.getByRole("dialog").getByText("Match!").waitFor({ timeout: 10000 });
check("match dialog names the idea", await s.getByRole("dialog").getByText(third).isVisible());
await s.screenshot({ path: `${OUT}m17-03-match.png` });
let { rows: matched } = await db.query("SELECT i.id, i.title, i.source, c.status FROM deck_cards c JOIN ideas i ON i.id = c.idea_id WHERE c.title = $1", [third]);
check(`wishlist idea from the match (${JSON.stringify(matched[0])})`, matched[0]?.source === "deck" && matched[0].status === "matched");
const planHref = await s.getByRole("link", { name: "📅 Jetzt planen" }).getAttribute("href");
check(`"Jetzt planen" opens the plan page with the idea (${planHref})`, planHref === `/plan?idea=${matched[0]?.id}`);

// 6) Undo a match: the idea leaves the wishlist again
await s.getByRole("button", { name: "Weiter swipen" }).click();
await s.getByRole("button", { name: "Rückgängig" }).click();
await s.waitForTimeout(800);
check("undo of a match removes the wishlist idea", (await db.query("SELECT 1 FROM ideas WHERE source = 'deck'")).rowCount === 0);
check("…and the card is back on top", (await topTitle(s)) === third);
await s.getByRole("button", { name: "Gefällt mir" }).click();
await s.getByRole("dialog").getByText("Match!").waitFor({ timeout: 10000 });
await s.getByRole("link", { name: "📅 Jetzt planen" }).click();
await s.waitForURL(/\/plan\?idea=/, { timeout: 10000 });
check("plan page opened from the match", new URL(s.url()).pathname === "/plan");

// 7) Filter: only event combos
await s.goto(`${BASE}/ideas/entdecken`);
await topCard(s).waitFor({ timeout: 15000 });
await s.waitForTimeout(800);
await s.getByRole("button", { name: "🎟️ Mit Event" }).click();
const comboTitle = await topTitle(s);
check(`event filter shows a combo (${comboTitle})`, comboTitle.startsWith("Kombi") && (await topCard(s).getByText("🎟️ Konzert: Annenmaykantereit").isVisible()));
check("combo knows you are both free", await topCard(s).getByText("✓ Ihr habt beide Zeit").isVisible());
await s.screenshot({ path: `${OUT}m17-04-combo.png` });

// 8) Nudge: Jonas liked cards Sam has not seen → one push per day (logged)
await fetch(`${BASE}/api/cron/tick`, CRON);
await fetch(`${BASE}/api/cron/tick`, CRON);
const { rows: nudges } = await db.query("SELECT user_id FROM notification_log WHERE type = 'deck_nudge'");
check(`nudge for Sam, once (${nudges.length})`, nudges.length === 1 && nudges[0].user_id === sam.id);

// 9) Settings: event combos "Viele"
await j.goto(`${BASE}/settings`);
await j.getByRole("radio", { name: "Viele" }).click();
await j.waitForTimeout(800);
check("event mix saved", (await db.query("SELECT deck_event_mix FROM couple_settings WHERE couple_id = $1", [couple.id])).rows[0].deck_event_mix === "lots");

// 10) Home tile and "Neue Ideen holen" when everything is swiped
await j.goto(`${BASE}/`);
const tile = j.getByRole("link", { name: /neue Ideen zum Swipen/ });
check(`home tile (${await tile.innerText().catch(() => "–")})`, await tile.isVisible());
await db.query("UPDATE deck_cards SET status = 'passed' WHERE couple_id = $1 AND status = 'open'", [couple.id]);
const callsBefore = claudeCalls.length;
await db.query("UPDATE couple_settings SET deck_refill_started_at = now() WHERE couple_id = $1", [couple.id]); // as if a batch were running
await j.goto(`${BASE}/ideas/entdecken`);
await j.getByText("Neue Ideen werden gemischt").waitFor({ timeout: 10000 });
await db.query("UPDATE couple_settings SET deck_refill_started_at = NULL WHERE couple_id = $1", [couple.id]);
await topCard(j).waitFor({ timeout: 30000 });
const { rows: batch2 } = await db.query("SELECT count(*)::int AS n, count(*) FILTER (WHERE kind = 'combo')::int AS combos FROM deck_cards WHERE batch = 2");
check(`second batch, no repeats of the first (${batch2[0].n} cards, ${batch2[0].combos} combos – the two events are used already)`, claudeCalls.length === callsBefore + 1 && batch2[0].n === 20 && batch2[0].combos === 0);
check("second prompt excludes the first batch and knows the taste", claudeCalls.at(-1).messages[0].content.includes(first) && /They liked: .+/.test(claudeCalls.at(-1).messages[0].content));

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
await browser.close();
await db.end();
process.exit(failures ? 1 : 0);
