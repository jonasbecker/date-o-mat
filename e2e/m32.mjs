// M32: the swipe card V2 "Kacheln" and its full screen (docs/design/garten/swipe-karte-v2/) at 390 × 844 and 360 × 740:
// five banner scenes (yoga, zoo, stadion, freizeitpark, shoppen), a long title and description, very short texts, an idea
// without a place, the day strip ("✓ beide frei" / "kein Slot frei") – nothing overlaps, no empty room on the card; the
// full screen with its map only where there is a place, and Kompost / Einpflanzen right there.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { tuesdayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { BUSY, startMock } from "./google-mock.mjs";
import { layoutAudit } from "./layout-audit.mjs";

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
await startMock(4010);
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions, ideas");

async function makeCouple(names, tokens) {
  const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
  const people = [];
  for (const [i, name] of names.entries()) {
    const email = i ? "partnerin@example.com" : "jonas@example.com";
    const { rows } = await db.query(
      "INSERT INTO users (google_sub, email, name, couple_id, color, created_at, onboarded_at) VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id",
      [`sub-${email}`, email, name, couple.id, i ? "himmel" : "mandarine", `2026-01-0${i + 1}`],
    );
    const token = randomBytes(32).toString("base64url");
    await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [createHash("sha256").update(token).digest("hex"), rows[0].id]);
    await db.query(
      `INSERT INTO google_connections (user_id, refresh_token_enc, access_token_enc, access_token_expires_at, busy_calendar_ids)
       VALUES ($1, $2, $3, now() + interval '30 days', '{primary}')`,
      [rows[0].id, encrypt("fake-refresh"), encrypt(tokens[i])],
    );
    people.push({ id: rows[0].id, token });
  }
  await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, people[0].id, tuesdayMorningOffset()]);
  return { id: couple.id, people };
}
const a = await makeCouple(["Jonas", "Sam"], ["token-jonas", "token-sam"]);

const LONG = "1. FC Köln gegen Borussia Mönchengladbach im RheinEnergieStadion mit Fahnen, Gesang und Bratwurst";
// title, motif, note, location, setting, cost, size
const CARDS = [
  ["Yoga im Rheinpark", "yoga", "Matten mit, Sonnengruß am Wasser.", "Rheinpark", "outdoor", 0, "small"],
  [LONG, "stadion", "Ihr holt euch Karten für die Südkurve, singt jedes Lied mit und gönnt euch danach ein Kölsch am Stadion – laut, eng und genau richtig für einen Abend, an dem ihr einfach mal mitschreien wollt. ".repeat(2), "RheinEnergieStadion, Aachener Straße 999, 50933 Köln-Müngersdorf", "outdoor", 60, "large"],
  ["Zoo", "zoo", null, "Kölner Zoo", null, 46, "large"],
  ["Phantasialand", "freizeitpark", "Achterbahn!", null, "outdoor", 120, "large"],
  ["Shoppen", "shoppen", null, null, null, null, "small"],
];
for (const [i, [title, motif, note, location, setting, cost, size]] of CARDS.entries()) {
  await db.query(
    "INSERT INTO deck_cards (couple_id, kind, title, note, size, cost_eur, location, setting, motif, dedupe_key, batch, created_at) VALUES ($1, 'idea', $2, $3, $4, $5, $6, $7, $8, $2, 1, now() - make_interval(mins => $9))",
    [a.id, title, note, size, cost, location, setting, motif, 100 - i],
  );
}

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

/** The top card's geometry: banner, title lines, tiles, strip – and whether anything is cut or leaves empty room. */
const measure = (page) =>
  page.evaluate(() => {
    const top = document.querySelector('[aria-roledescription="Karte"]');
    const card = top.querySelector(".swipe-card");
    const r = (el) => el.getBoundingClientRect();
    const c = r(card);
    const banner = top.querySelector("[data-banner]");
    const title = top.querySelector("h2");
    const strip = top.querySelector("[data-card-info]");
    const tiles = [...top.querySelectorAll("[data-fact]")];
    const lh = parseFloat(getComputedStyle(title).lineHeight);
    return {
      motif: banner.getAttribute("data-banner"),
      shapes: banner.querySelectorAll("div > div").length,
      bannerH: Math.round(r(banner).height),
      cardH: Math.round(c.height),
      titleLines: Math.round(r(title).height / lh),
      titleCut: title.scrollHeight > title.clientHeight + 1,
      // The strip sits at the bottom: what is left under it is the card's padding, nothing more.
      below: Math.round(c.bottom - r(strip).bottom),
      stripInside: r(strip).bottom <= c.bottom - 4,
      tilesOk: tiles.every((t) => t.scrollHeight <= t.clientHeight + 1 && t.getBoundingClientRect().height >= 70),
      tiles: tiles.map((t) => t.querySelector(":scope > span:last-child").textContent),
      dense: card.getAttribute("data-card-dense"),
      strip: strip.textContent,
    };
  });

for (const [width, height] of [
  [390, 844],
  [360, 740],
]) {
  await db.query("DELETE FROM deck_swipes WHERE card_id IN (SELECT id FROM deck_cards WHERE couple_id = $1)", [a.id]);
  await db.query("UPDATE deck_cards SET status = 'open' WHERE couple_id = $1", [a.id]);
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.route("https://maps.google.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<html><body style='margin:0;background:#cfe3d0'></body></html>" }));
  await ctx.addCookies([{ name: "dom_session", value: a.people[0].token, url: BASE }]);
  const j = await ctx.newPage();
  j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await j.goto(`${BASE}/ideas/entdecken`);
  const top = j.locator('[aria-roledescription="Karte"]');
  await top.waitFor({ timeout: 20000 });
  await j.waitForTimeout(1200);
  const size = `${width}×${height}`;

  for (const [title, motif] of CARDS) {
    for (let i = 0; i < 40 && (await top.getAttribute("aria-label")) !== title; i++) await j.waitForTimeout(100);
    await j.waitForTimeout(500);
    const m = await measure(j);
    const name = title.slice(0, 24);
    check(`${size} „${name}“: banner ${m.motif} with its shapes (${m.shapes})`, m.motif === motif && m.shapes > 3);
    check(`${size} „${name}“: title ≤ 2 lines, tiles whole (${m.tiles.join(" | ")}), strip inside (dense ${m.dense})`, m.titleLines <= 2 && m.tilesOk && m.stripInside);
    check(`${size} „${name}“: no empty room – banner ${m.bannerH}px, under the strip ${m.below}px`, m.below <= 24 && m.bannerH >= 72);
    const { issues } = await layoutAudit(j);
    check(`${size} „${name}“: nothing overlaps or is cut off${issues.length ? `: ${issues.join("; ")}` : ""}`, issues.length === 0);
    await j.screenshot({ path: `${OUT}m32-${width}-${motif}.png` });
    if (title === "Phantasialand") check(`${size} no place: wo = draußen (${m.tiles[0]})`, m.tiles[0] === "draußen");
    if (title === "Shoppen") check(`${size} very short: wo egal, kosten offen (${m.tiles.join(", ")})`, m.tiles[0] === "egal" && m.tiles[2] === "offen");
    check(`${size} „${name}“: the strip says when both are free (${m.strip})`, /✓ beide frei/.test(m.strip));

    // The full screen: banner with ✕, the map only with a place, Kompost / Einpflanzen at the bottom
    if (title === LONG || title === "Phantasialand") {
      const box = await top.boundingBox();
      await j.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
      await j.locator("[data-swipe-deck][data-full]").waitFor({ timeout: 5000 });
      await j.waitForTimeout(600);
      const full = top.locator("[data-card-full]");
      const maps = await full.locator("[data-map-embed]").count();
      const bar = top.locator("[data-card-bar]");
      check(`${size} full „${name}“: map + Maps button only with a place (${maps})`, title === LONG ? maps === 1 && (await full.locator("[data-maps-link]").count()) === 1 : maps === 0 && (await full.locator("[data-maps-link]").count()) === 0);
      check(`${size} full: Kompost and Einpflanzen in the bar, ✕ on the banner`, (await bar.getByRole("button", { name: "Kompost" }).isVisible()) && (await bar.getByRole("button", { name: "Einpflanzen" }).isVisible()) && (await top.getByRole("button", { name: "Schließen" }).isVisible()));
      // What scrolls passes under the bar on its way – at the end of the text nothing is left under it.
      await full.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await j.waitForTimeout(300);
      const fullIssues = (await layoutAudit(j)).issues;
      check(`${size} full: nothing overlaps or is cut off${fullIssues.length ? `: ${fullIssues.join("; ")}` : ""}`, fullIssues.length === 0);
      await j.screenshot({ path: `${OUT}m32-${width}-voll-${motif}.png` });
      if (title === LONG) {
        // ✕ makes it small again
        await top.getByRole("button", { name: "Schließen" }).click();
        await j.locator("[data-swipe-deck][data-full]").waitFor({ state: "detached", timeout: 5000 });
        check(`${size} ✕ makes it small again`, (await j.locator("[data-swipe-deck][data-full]").count()) === 0);
      } else {
        // Einpflanzen right in the full screen: planted, the next card comes, still full
        await bar.getByRole("button", { name: "Einpflanzen" }).click();
        for (let i = 0; i < 40 && (await top.getAttribute("aria-label")) === title; i++) await j.waitForTimeout(100);
        const { rows: [s] } = await db.query("SELECT s.verdict FROM deck_swipes s JOIN deck_cards c ON c.id = s.card_id WHERE c.title = $1", [title]);
        check(`${size} full: Einpflanzen plants it (${s?.verdict}), the next card shows, still full`, s?.verdict === "like" && (await top.getAttribute("aria-label")) === "Shoppen" && (await j.locator("[data-swipe-deck][data-full]").count()) === 1);
        await top.getByRole("button", { name: "Schließen" }).click();
        await j.locator("[data-swipe-deck][data-full]").waitFor({ state: "detached", timeout: 5000 });
        continue;
      }
    }
    if (title === "Shoppen") {
      // Kompost right in the full screen
      const box = await top.boundingBox();
      await j.mouse.click(box.x + box.width / 2, box.y + box.height * 0.45);
      await j.locator("[data-swipe-deck][data-full]").waitFor({ timeout: 5000 });
      await j.waitForTimeout(500);
      await j.screenshot({ path: `${OUT}m32-${width}-voll-shoppen.png` });
      await top.locator("[data-card-bar]").getByRole("button", { name: "Kompost" }).click();
      await j.waitForTimeout(800);
      const { rows: [k] } = await db.query("SELECT s.verdict FROM deck_swipes s JOIN deck_cards c ON c.id = s.card_id WHERE c.title = 'Shoppen'");
      check(`${size} full: Kompost composts it (${k?.verdict})`, k?.verdict === "nope");
      break;
    }
    // On to the next card
    await top.getByRole("button", { name: "Auf den Kompost" }).dispatchEvent("click");
    await j.waitForTimeout(500);
  }
  await ctx.close();
}

// No free evening for both: the strip says so. Both calendars full for weeks; the clock a week back, so the few minutes
// of cached busy times (busy-cache.ts) do not cover the new search.
{
  const full = [{ start: new Date(Date.now() - 30 * 86_400_000).toISOString(), end: new Date(Date.now() + 60 * 86_400_000).toISOString() }];
  BUSY["token-jonas"] = { primary: full };
  BUSY["token-sam"] = { primary: full };
  await db.query("UPDATE couple_settings SET dev_clock_offset_minutes = $2 WHERE couple_id = $1", [a.id, tuesdayMorningOffset() - 7 * 24 * 60]);
  await db.query("DELETE FROM deck_swipes WHERE card_id IN (SELECT id FROM deck_cards WHERE couple_id = $1)", [a.id]);
  await db.query("UPDATE deck_cards SET status = 'open' WHERE couple_id = $1", [a.id]);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: a.people[0].token, url: BASE }]);
  const j = await ctx.newPage();
  await j.goto(`${BASE}/ideas/entdecken`);
  await j.locator('[aria-roledescription="Karte"]').waitFor({ timeout: 20000 });
  await j.waitForTimeout(800);
  const m = await measure(j);
  check(`no common free evening: „kein Slot frei“ (${m.strip})`, /kein Slot frei/.test(m.strip) && m.motif === "yoga");
  await j.screenshot({ path: `${OUT}m32-390-kein-slot.png` });
  await ctx.close();
}

// /dev/motive: what each idea would get, change one, take the rest over
{
  await db.query("INSERT INTO ideas (couple_id, title, size, source) VALUES ($1, 'Picknick im Stadtwald', 'small', 'wishlist'), ($1, 'Etwas ganz Eigenes', 'small', 'wishlist'), ($1, 'Kino', 'small', 'wishlist')", [a.id]);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: a.people[0].token, url: BASE }]);
  const j = await ctx.newPage();
  await j.goto(`${BASE}/dev/motive`);
  const row = (t) => j.locator(`tr[data-motif-for="${t}"]`);
  await row("Kino").waitFor({ timeout: 20000 });
  check(`motive: suggestions from the words, herz where nothing fits (${await row("Picknick im Stadtwald").getAttribute("data-motif")}, ${await row("Etwas ganz Eigenes").getAttribute("data-motif")})`, (await row("Picknick im Stadtwald").getAttribute("data-motif")) === "picknick" && (await row("Etwas ganz Eigenes").getAttribute("data-motif")) === "herz");
  await j.screenshot({ path: `${OUT}m32-motive.png`, fullPage: true });
  await row("Kino").getByRole("combobox").selectOption("filmabend");
  await j.waitForTimeout(800);
  await j.getByRole("button", { name: /Vorschläge übernehmen/ }).click();
  await j.getByRole("status").waitFor({ timeout: 10000 });
  const { rows } = await db.query("SELECT title, motif FROM ideas WHERE couple_id = $1 AND title IN ('Picknick im Stadtwald', 'Etwas ganz Eigenes', 'Kino') ORDER BY title", [a.id]);
  check(`motive: one changed by hand, the rest taken over (${rows.map((r) => `${r.title}=${r.motif}`).join(", ")})`, rows.map((r) => r.motif).join(",") === "herz,filmabend,picknick");
  await ctx.close();
}

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
