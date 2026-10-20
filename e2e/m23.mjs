// M36: categories as chips above the wishlist, your likes stay visible (origin tags, "Geswipt"),
// the swipe deck counts what you did and the 💡 counts up with every new wishlist idea.
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { tuesdayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { fitsScreen } from "./flow.mjs";

const BASE = "http://localhost:3000";
const OUT = new URL("./shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions, ideas");
const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
async function makeUser(name, email, color, createdAt) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color, createdAt],
  );
  const token = randomBytes(32).toString("base64url");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "2026-01-01");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset()]);

// Wishlist: two typed by hand (one with a stored category, one inferred), one liked by Jonas, one by Sam.
const idea = (title, by, source, category = null) =>
  db.query("INSERT INTO ideas (couple_id, title, size, source, category, created_by_id) VALUES ($1, $2, 'small', $3, $4, $5)", [couple.id, title, source, category, by.id]);
await idea("Töpferkurs", jonas, "wishlist", "creative");
await idea("Sushi-Abend", sam, "wishlist");
await idea("Wanderung im Siebengebirge", jonas, "deck", "nature");
await idea("Pizza backen", sam, "deck", "food");
for (const title of ["Minigolf im Rheinpark", "Kino unter Sternen", "Brettspiel-Café"]) {
  await db.query("INSERT INTO deck_cards (couple_id, kind, title, size, dedupe_key, batch) VALUES ($1, 'idea', $2, 'small', $2, 1)", [couple.id, title]);
}

let failures = 0;
const check = (label, ok) => { console.log(`${ok ? "✓" : "✗"} ${label}`); if (!ok) failures++; };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, scheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE", colorScheme: scheme });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  return page;
}

// 0) The ideas page (MIdeen): the field, the matches tile, the kinds as tiles
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/ideas`);
await j.getByRole("heading", { name: "ideen." }).waitFor({ timeout: 20000 });
check("tiles: Matchlinge + six kinds", (await j.getByRole("button", { name: /^Matchlinge: \d+$/ }).isVisible()) && (await j.getByRole("button", { name: /^(Kurz|Lang|Draußen|Drinnen|Mit Ort|Eigene): \d+$/ }).count()) === 6);
check("the field for your own idea", await j.getByRole("textbox", { name: "Neue Idee" }).isVisible());
await j.screenshot({ path: `${OUT}m23-00-tiles.png` });
check("the ideas page fits the screen", await fitsScreen(j));
const shortTile = j.getByRole("button", { name: /^Kurz: \d+$/ });
const shortCount = Number((await shortTile.getAttribute("aria-label")).replace(/\D/g, ""));
await shortTile.click();
await j.getByRole("heading", { name: "kurz." }).waitFor({ timeout: 10000 });
check(`a tile opens its list (${shortCount} kurze)`, (await j.locator("li.animate-pop-in").filter({ visible: true }).count()) === shortCount);
await j.getByRole("link", { name: "Zurück zu den Kacheln" }).click();
await j.getByRole("heading", { name: "ideen." }).waitFor({ timeout: 10000 });

// 1) The wishlist: chips with counts, origin tags, category emoji
await j.goto(`${BASE}/ideas?ansicht=alle`);
const items = j.locator("li.animate-pop-in").filter({ visible: true });
await items.first().waitFor({ timeout: 20000 });
check("no chip row above the list any more (only the Filter button)", (await j.getByRole("group", { name: "Ideen ansehen nach" }).count()) === 0 && (await j.getByRole("button", { name: "Filter", exact: true }).isVisible()));
check("origin tags: von dir geswipt / Sam hat's geliked", (await items.filter({ hasText: "💚 von dir geswipt" }).count()) === 1 && (await items.filter({ hasText: "💚 Sam hat's geliked" }).count()) === 1);
await j.screenshot({ path: `${OUT}m23-01-wishlist.png` });

// 2) Geswipt (a tile / ?ansicht=geswipt) shows exactly the swiped ones
await j.goto(`${BASE}/ideas?ansicht=geswipt`);
await items.first().waitFor({ timeout: 20000 });
check("Geswipt: only the two swiped ideas", (await items.count()) === 2);

// 3) The category is a question in the one Filter
await j.goto(`${BASE}/ideas?ansicht=alle`);
await items.first().waitFor({ timeout: 20000 });
await j.waitForTimeout(800);
await j.getByRole("button", { name: "Filter", exact: true }).click();
await j.locator("dialog[open]").getByRole("button", { name: /Kreativ/ }).click();
await j.locator("dialog[open]").getByRole("button", { name: "Fertig" }).click();
check("category Kreativ (in the Filter): only the Töpferkurs", (await items.count()) === 1 && (await items.filter({ hasText: "Töpferkurs" }).count()) === 1);
await j.getByRole("button", { name: /^Filter: / }).click();
await j.locator("dialog[open]").getByRole("button", { name: "Zurücksetzen" }).click();
await j.locator("dialog[open]").getByRole("button", { name: "Fertig" }).click();
check("Zurücksetzen clears the category", (await items.count()) === 4);

// 4) The deck page: the 💡 counts up with a like, the progress line follows
await j.goto(`${BASE}/ideas/entdecken`);
const deck = j.locator('[data-swipe-deck="page"]');
await deck.locator('[aria-roledescription="Karte"]').waitFor({ timeout: 20000 });
const bulb = j.locator('[data-header-icon="wishlist"]').filter({ visible: true }).first();
const badge = async () => ((await bulb.innerText().catch(() => "")) || "").replace(/\D/g, "");
await bulb.waitFor({ timeout: 10000 });
check("the 💡 starts at 4", (await badge()) === "4");
for (let i = 0; i < 20 && (await badge()) !== "5"; i++) {
  await deck.getByRole("button", { name: "Einpflanzen" }).dispatchEvent("click");
  await j.waitForTimeout(700);
}
check(`the 💡 counts up to 5 after a like (${await badge()})`, (await badge()) === "5");
await j.screenshot({ path: `${OUT}m23-02-liked.png` });
// The count sits behind ⓘ next to the Matchlinge (nothing small under the card)
await j.getByRole("button", { name: "So geht Swipen" }).click();
const progress = j.locator("dialog[open] [data-swipe-progress]");
await progress.waitFor({ timeout: 10000 }).catch(() => {});
check(`ⓘ: how it works and the progress (${await progress.innerText().catch(() => "")})`, /^1 geswipt · \d+ übrig$/.test(((await progress.innerText().catch(() => "")) || "").trim()) && (await j.locator("dialog[open]").getByText(/Rechts wischen = einpflanzen/).isVisible()));
await j.screenshot({ path: `${OUT}m23-02b-info.png` });
await j.keyboard.press("Escape");
await j.locator("dialog[open]").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});

// 5) The deck page fits the screen and links to "Meine Likes"
check("deck page fits the screen", await fitsScreen(j));
await j.getByRole("link", { name: "Meine Likes" }).click();
await items.first().waitFor({ timeout: 20000 });
check("Meine Likes opens the wishlist on Geswipt", (await j.getByRole("heading", { name: "geswipt." }).isVisible()) && (await items.count()) === 3);
await j.screenshot({ path: `${OUT}m23-03-my-likes.png` });

// 6) Dark mode
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/ideas?ansicht=alle`);
await jd.locator("li.animate-pop-in").filter({ visible: true }).first().waitFor({ timeout: 20000 });
await jd.screenshot({ path: `${OUT}m23-04-wishlist-dark.png` });

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
