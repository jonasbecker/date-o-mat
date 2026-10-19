// M13: next step, intro, info hints, plan tabs, settings groups.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { backAtStart, customIdea, fitsScreen, openFlow, pickIdea } from "./flow.mjs";
import { startMock } from "./google-mock.mjs";
import { tuesdayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";

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
const google = await startMock(4010);
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
// A few cards for the swipe deck on the start page.
for (const title of ["Minigolf im Rheinpark", "Kino unter Sternen", "Brettspiel-Café"]) {
  await db.query("INSERT INTO deck_cards (couple_id, kind, title, size, dedupe_key, batch) VALUES ($1, 'idea', $2, 'small', $2, 1)", [couple.id, title]);
}
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

// The state of the round / of the next date: the step card on "Date planen" or "Dates".
const heading = async (p) => {
  const h = p.locator("[data-next-step] h2").filter({ visible: true }).first();
  await h.waitFor({ timeout: 15000 }).catch(() => {});
  return (await h.innerText()).trim();
};

// 1) Jonas' turn: one big next step
const j = await pageFor(jonas.token);
await j.goto(`${BASE}/`);
await heading(j);
check(`next step: "${await heading(j)}"`, (await heading(j)) === "Du bist dran!");
check("period instead of round number", await j.locator("[data-next-step]").getByText(/^Diese Woche · Plan bis/).isVisible());
check("home is focused: no separate surprise / push cards", (await j.getByRole("button", { name: /Überrasch uns/ }).count()) === 0);
check("'Date planen' sits in the step card", await j.locator("[data-next-step]").filter({ visible: true }).getByRole("link", { name: "Date planen", exact: true }).isVisible());
const startIdeas = j.locator("[data-start-ideas]").filter({ visible: true });
await startIdeas.locator("li").first().waitFor({ timeout: 15000 });
check("the wishlist sits right below the box, longest waiting first", (await startIdeas.locator("li").count()) === 4 && (await startIdeas.locator("li").first().innerText()).includes("Picknick im Stadtwald"));
check("swiping is one button next to the title", await startIdeas.locator("[data-swipe-link]").isVisible());
await j.screenshot({ path: `${OUT}m13-01-home-plan.png`, fullPage: true });
check("start with the wishlist fits the screen", await fitsScreen(j));
// Tapping an idea goes straight to its free times (no date ahead yet).
await startIdeas.getByRole("button", { name: "Tagesausflug nach Bonn", exact: true }).click();
await j.locator("ol li button").first().waitFor({ timeout: 20000 });
check("a tap on an idea opens its free times", j.url().includes("idea="));
// A like on the swipe page puts the card on the wishlist.
await j.goto(`${BASE}/ideas/entdecken`);
const swipeDeck = j.locator('[data-swipe-deck="page"]');
await swipeDeck.locator('[aria-roledescription="Karte"]').waitFor({ timeout: 15000 });
// A tap before hydration does nothing (CI is slower): tap again until the next card shows.
const nextCard = swipeDeck.getByRole("heading", { name: "Kino unter Sternen" });
for (let i = 0; i < 6 && !(await nextCard.isVisible()); i++) {
  await swipeDeck.getByRole("button", { name: "Gefällt mir" }).click().catch(() => {});
  await nextCard.waitFor({ timeout: 2500 }).catch(() => {});
}
await nextCard.waitFor({ timeout: 5000 });
await j.waitForTimeout(800);
const { rows: [liked] } = await db.query("SELECT count(*)::int AS c FROM ideas WHERE couple_id = $1 AND title = 'Minigolf im Rheinpark'", [couple.id]);
check("a like on the swipe page saves it to the wishlist", liked.c === 1);
await j.goto(`${BASE}/`);
await heading(j);

// 2) ⓘ explains "Plan bis"
await j.getByRole("button", { name: "Was heißt „Plan bis …“?" }).click();
await j.getByText("Bis dahin sollte euer Date feststehen").waitFor({ timeout: 5000 });
check("info popover opens", true);
await j.screenshot({ path: `${OUT}m13-02-info.png` });
await j.getByRole("button", { name: "Verstanden" }).filter({ visible: true }).click();
await j.waitForTimeout(300);
check("info popover closes", !(await j.getByText("Bis dahin sollte euer Date feststehen").isVisible()));

// 3) Sam's view: partner's turn
const s = await pageFor(sam.token);
await s.goto(`${BASE}/`);
await heading(s);
check(`Sam: "${await heading(s)}"`, (await heading(s)) === "Jonas ist dran");
// Not Sam's turn: the same box (with "Ich übernehme diesmal") and the deck below
await s.locator("[data-start-ideas] li").first().waitFor({ timeout: 15000 });
check("partner's turn: box + wishlist", (await s.getByRole("button", { name: "Ich übernehme diesmal" }).isVisible()) && (await s.getByRole("link", { name: "Date planen", exact: true }).count()) === 0);
await s.screenshot({ path: `${OUT}m13-12-partner-swipe.png` });
check("partner's start fits the screen", await fitsScreen(s));

// 4) "Date planen" in the step card opens the wishlist (no quick plan)
await j.goto(`${BASE}/plan`);
await openFlow(j);
check("'Date planen' opens /plan?pick=1", j.url().endsWith("/plan?pick=1"));
await j.getByRole("list", { name: "Eure Wunschliste" }).waitFor({ timeout: 20000 });
check("no quick plan any more", (await j.getByText("Schnell planen").count()) === 0);
await j.screenshot({ path: `${OUT}m13-03-plan-top.png` });
check("no tab row for idea sources any more", (await j.getByRole("tab").count()) === 0);
check("wishlist first, then Zufall / Was anderes", (await j.getByRole("button", { name: "Zufall" }).isVisible()) && (await j.getByRole("button", { name: "Was anderes" }).isVisible()));
await j.getByRole("button", { name: "Was anderes" }).click();
const row = j.locator("dialog[open] li", { hasText: "Sonnenuntergang am Rheinboulevard" });
await row.getByRole("button", { name: "Nehmen" }).click();
const chosen = (title) => j.locator("div", { hasText: "Ihr macht" }).getByText(title, { exact: true }).first();
await chosen("Sonnenuntergang am Rheinboulevard").waitFor({ timeout: 10000 });
check("Köln idea taken → straight on to the times", !(await j.locator("dialog[open]").count()) && (await j.getByRole("heading", { name: "Wann?" }).isVisible()));
const { rows: curated } = await db.query("SELECT count(*)::int AS n FROM ideas WHERE source = 'curated'");
check("…and put on the wishlist", curated[0].n === 1);
await j.getByRole("button", { name: "← Andere Idee" }).click();
await customIdea(j, "Eis am Rhein", "Rheinufer");
check("own idea (with place) goes on to the times too", (await chosen("Eis am Rhein").isVisible()) && (await j.getByText("📍 Rheinufer").isVisible()));
await j.screenshot({ path: `${OUT}m13-04-plan-tabs.png`, fullPage: true });
await j.getByRole("button", { name: "← Andere Idee" }).click();
await pickIdea(j, "Picknick im Stadtwald");
check("picking a wishlist idea replaces the own idea", await chosen("Picknick im Stadtwald").isVisible());
check("no surprise option before the first date", (await j.getByText("🎁 Als Überraschung planen").count()) === 0);

// 5) Planned → Sam's next step is "Passt!"
await j.getByRole("button", { name: "Date festlegen 🎉" }).click();
await backAtStart(j, BASE);
check(`Jonas waits: "${await heading(j)}"`, (await heading(j)) === "Wartet auf Sams „Passt!“");
await s.goto(`${BASE}/`);
await s.waitForURL(`${BASE}/plan`, { timeout: 15000 });
check(`Sam must confirm: "${await heading(s)}"`, (await heading(s)) === "Jonas hat ein Date geplant 🎉");
check("only one Passt! button on the page", (await s.getByRole("button", { name: "Passt! 💚" }).count()) === 1);
check("Passt! to give: the box first, the wishlist below it", await s.locator("[data-start-ideas]").filter({ visible: true }).isVisible());
check("Passt! state fits the screen", await fitsScreen(s));
await s.screenshot({ path: `${OUT}m13-05-home-confirm.png`, fullPage: true });
await s.getByRole("button", { name: "Passt! 💚" }).click();
await s.getByRole("heading", { name: "Date steht! 🎉" }).waitFor({ timeout: 15000 });
check("after Passt!: Date steht!", true);

// 6) Settings: a list of topics, each its own screen; intro again
await j.goto(`${BASE}/settings`);
await j.getByRole("navigation", { name: "Themen" }).waitFor({ timeout: 15000 });
check("settings start as a menu of topics", (await j.getByRole("navigation", { name: "Themen" }).getByRole("link").count()) >= 10);
check("no topic open yet", !(await j.getByLabel("Suchen für").isVisible()) && !(await j.getByRole("button", { name: "Abmelden" }).isVisible()));
await j.screenshot({ path: `${OUT}m13-06-settings-menu.png` });
check("settings menu fits the screen", await fitsScreen(j));
await j.getByRole("link", { name: /Extras/ }).click();
const surpriseSwitch = j.getByRole("checkbox", { name: /Überraschungs-Date/ });
check("extras are on by default", await surpriseSwitch.isChecked());
await surpriseSwitch.uncheck();
await j.waitForTimeout(800);
const { rows: [hidden] } = await db.query("SELECT hidden_extras FROM couple_settings WHERE couple_id = $1", [couple.id]);
check(`switching an extra off is saved for both (${JSON.stringify(hidden.hidden_extras)})`, JSON.stringify(hidden.hidden_extras) === '["surprise"]');
await surpriseSwitch.check();
await j.waitForTimeout(800);
await j.screenshot({ path: `${OUT}m13-06-settings.png` });
await j.getByRole("link", { name: "← Alle Einstellungen" }).click();
await j.getByRole("link", { name: /Einführung/ }).click();
await j.getByRole("heading", { name: "Willkommen, Jonas!" }).waitFor({ timeout: 10000 });
check("intro can be watched again", true);
await j.waitForTimeout(800);
await j.getByRole("button", { name: "Weiter" }).click();
await j.waitForTimeout(600);
await j.screenshot({ path: `${OUT}m13-07-welcome.png` });

// 6b) The bottom bar: Dates opens the history, the logo starts planning, Ideen leads to the wishlist
await j.goto(`${BASE}/plan`);
await j.locator("[data-next-step]").filter({ visible: true }).first().waitFor({ timeout: 15000 });
const bar = j.getByRole("navigation", { name: "Hauptmenü" });
await bar.getByRole("link", { name: "Eure Dates", exact: true }).click();
await j.waitForURL(`${BASE}/dates`, { timeout: 10000 });
await j.getByRole("heading", { name: "Eure Dates" }).waitFor({ timeout: 10000 });
check("Dates opens the history, marked as the current page", (await bar.getByRole("link", { name: "Eure Dates", exact: true }).getAttribute("aria-current")) === "page");
await j.screenshot({ path: `${OUT}m13-13-panel.png` });
await bar.getByRole("link", { name: "Zum Start" }).click();
await j.waitForURL(`${BASE}/plan`, { timeout: 15000 });
await j.locator("[data-next-step]").filter({ visible: true }).first().waitFor({ timeout: 15000 });
check("the logo leads to the start, not into the flow", !j.url().includes("pick=1"));
// On the start itself the logo opens the actions: Date planen, Idee, Überrasch uns
const menuBtn = bar.getByRole("button", { name: "Aktionen" });
await menuBtn.click();
const menu = j.getByRole("menu", { name: "Aktionen" });
check("the logo on the start opens four actions", (await menu.getByRole("menuitem").count()) === 4 && (await menuBtn.getAttribute("aria-expanded")) === "true");
await j.waitForTimeout(500);
await j.screenshot({ path: `${OUT}m13-14-logo-menu.png` });
await menu.getByRole("menuitem", { name: "Idee" }).click();
await j.locator("dialog[open]").getByText("Neue Idee").waitFor({ timeout: 10000 });
check("Idee opens the idea form right here", true);
await j.keyboard.press("Escape");
await menuBtn.click();
await menu.getByRole("menuitem", { name: "Date planen" }).click();
await j.getByRole("heading", { name: "Was wollt ihr machen?" }).waitFor({ timeout: 15000 });
check("Date planen opens the flow", j.url().includes("pick=1"));
await j.goto(`${BASE}/plan`);
await menuBtn.click();
await j.keyboard.press("Escape");
check("Escape closes the menu", (await menu.count()) === 0);
await bar.getByRole("link", { name: "Ideen", exact: true }).click();
await j.getByRole("heading", { name: "Wunschliste" }).waitFor({ timeout: 15000 });
check("Ideen opens the wishlist", (await bar.getByRole("link", { name: "Ideen", exact: true }).getAttribute("aria-current")) === "page");
check("top: name + settings only", (await j.locator("header:visible a").evaluateAll((a) => a.map((x) => x.getAttribute("aria-label")))).join("|") === "Date-O-Mat – zum Start|Einstellungen");

// 7) Dark mode + nav label
const jd = await pageFor(jonas.token, "dark");
await jd.goto(`${BASE}/`);
await heading(jd);
check("nav says Ideen", await jd.getByRole("navigation", { name: "Hauptmenü" }).getByRole("link", { name: "Ideen", exact: true }).isVisible());
await jd.screenshot({ path: `${OUT}m13-08-home-dark.png`, fullPage: true });
// Light cards stay light in dark mode – their text must stay dark (it used to turn light-on-light).
async function contrastOf(page, textLocator) {
  return textLocator.evaluate((el) => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    let bgEl = el;
    while (bgEl && getComputedStyle(bgEl).backgroundColor.match(/[\d.]+/g)?.[3] === "0") bgEl = bgEl.parentElement;
    const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(bgEl).backgroundColor))].sort((x, y) => y - x);
    return Math.round(((a + 0.05) / (b + 0.05)) * 10) / 10;
  });
}
await jd.goto(`${BASE}/welcome`);
await jd.getByRole("heading", { name: "Willkommen, Jonas!" }).waitFor({ timeout: 10000 });
await jd.waitForTimeout(800);
const welcomeContrast = await contrastOf(jd, jd.getByRole("heading", { name: "Willkommen, Jonas!" }));
const textContrast = await contrastOf(jd, jd.locator("p", { hasText: "regelmäßig Dates" }));
check(`welcome slide readable in dark mode (heading ${welcomeContrast}:1, text ${textContrast}:1)`, welcomeContrast >= 7 && textContrast >= 7);
await jd.screenshot({ path: `${OUT}m13-10-welcome-dark.png` });
// The date stands: it sits in the box, "Lieber was anderes?" leads to the ideas (swap mode)
await jd.goto(`${BASE}/plan`);
const swapLink = jd.getByRole("link", { name: "Lieber was anderes?" });
await swapLink.waitFor({ timeout: 20000 });
check("with a date: the date in the box, the wishlist below it", (await jd.locator("[data-next-step] [data-date-card]").filter({ visible: true }).count()) === 1 && (await jd.locator("[data-start-ideas]").filter({ visible: true }).isVisible()));
check("with a date: details one tap away", (await jd.getByRole("link", { name: "Details ›" }).getAttribute("href"))?.startsWith("/dates/"));
await jd.screenshot({ path: `${OUT}m13-09-plan-dark.png`, fullPage: true });
check("start with a confirmed date fits the screen", await fitsScreen(jd));
await swapLink.click();
await jd.getByText("Statt „Picknick im Stadtwald“", { exact: false }).waitFor({ timeout: 15000 });
check("swap mode: tap an idea to do it instead", (await jd.locator("ol li button").count()) === 0 && (await jd.getByRole("button", { name: "Zufall" }).isVisible()));
await jd.getByRole("list", { name: "Eure Wunschliste" }).getByRole("button", { name: "Sonnenuntergang am Rheinboulevard", exact: true }).click();
await jd.locator("dialog[open]").getByText("Willst du das ändern?", { exact: false }).waitFor({ timeout: 10000 });
await jd.screenshot({ path: `${OUT}m13-11-swap-dark.png` });
check("swap mode fits the screen", await fitsScreen(jd));
await jd.locator("dialog[open]").getByRole("button", { name: "Ja, ändern" }).click();
await jd.waitForURL(`${BASE}/plan`, { timeout: 15000 });
await jd.locator("[data-next-step]").filter({ visible: true }).getByText("„Sonnenuntergang am Rheinboulevard“").waitFor({ timeout: 15000 });
const { rows: [swappedDate] } = await db.query("SELECT title, status FROM date_plans WHERE couple_id = $1 AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1", [couple.id]);
check(`swapped on the start page, "Passt!" kept (${swappedDate.title}, ${swappedDate.status})`, swappedDate.title === "Sonnenuntergang am Rheinboulevard" && swappedDate.status === "confirmed");

await browser.close();
google.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
