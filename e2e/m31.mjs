// M31: the view behind a tile of the seed shelf (docs/design/garten/ideen-kategorie/) – every kind, every chip, at
// 390 × 844 and 360 × 740: head, flower and bubble apart, long titles cut with an ellipsis, the flower's tip not in the
// list, two groups, like badges, the list scrolls and ends above the tab bar; "Ins Beet pflanzen" opens "wann?" with
// the tip's evening picked; the empty view.
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import pg from "pg";
import { chromium } from "playwright";
import { tuesdayMorningOffset } from "./clock.mjs";
import { resetDb } from "./db.mjs";
import { startMock } from "./google-mock.mjs";
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
     VALUES ($1, $2, $3, now() + interval '30 days', '{primary}')`,
    [rows[0].id, encrypt("fake-refresh"), encrypt(accessToken)],
  );
  return { id: rows[0].id, token };
}
const jonas = await makeUser("Jonas", "jonas@example.com", "mandarine", "token-jonas", "2026-01-01");
const sam = await makeUser("Sam", "partnerin@example.com", "himmel", "token-sam", "2026-01-02");
await db.query("INSERT INTO couple_settings (couple_id, first_planner_id, dev_clock_offset_minutes) VALUES ($1, $2, $3)", [couple.id, jonas.id, tuesdayMorningOffset()]);

const LONG = "Ein sehr, sehr langer Titel für eine Idee, die nie in eine Zeile passt";
// title, size, cost, setting, location, source, by
const IDEAS = [
  ["Sonnenuntergang am Rheinboulevard", "small", 0, "outdoor", "Rheinboulevard, Köln", "wishlist", jonas],
  ["Pizza backen", "small", 15, "indoor", null, "deck", sam],
  ["Wanderung im Siebengebirge", "large", 0, "outdoor", null, "deck", jonas],
  ["Töpferkurs", "large", 60, "indoor", "Ehrenfeld", "wishlist", sam],
  ["Kino unter Sternen", "small", 12, "outdoor", null, "deck", jonas],
  [LONG, "small", null, null, null, "wishlist", jonas],
  ["Brettspiel-Café", "small", 8, "indoor", "Südstadt", "wishlist", sam],
  ["Museum Ludwig", "large", 14, "indoor", "Heinrich-Böll-Platz, Köln", "wishlist", jonas],
  ["Picknick im Stadtwald", "small", 0, "outdoor", "Stadtwald", "wishlist", sam],
  ["Karaoke-Abend", "small", 20, "indoor", null, "deck", sam],
  ["Kochkurs Thai", "small", 45, "indoor", null, "wishlist", jonas],
  ["Flohmarkt am Aachener Weiher", "large", 0, "outdoor", "Aachener Weiher", "wishlist", sam],
  ["Schwimmen im Agrippabad", "small", 9, "indoor", "Agrippabad", "wishlist", jonas],
  ["Sterne gucken in der Wahner Heide", "small", 0, "outdoor", "Wahner Heide", "wishlist", sam],
];
const ids = {};
for (const [i, [title, size, cost, setting, location, source, by]] of IDEAS.entries()) {
  const { rows } = await db.query(
    "INSERT INTO ideas (couple_id, title, size, cost_eur, setting, location, source, created_by_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() - make_interval(days => $9)) RETURNING id",
    [couple.id, title, size, cost, setting, location, source, by.id, 30 - i],
  );
  ids[title] = rows[0].id;
}
// "Kino unter Sternen" is a match: both liked it.
await db.query("INSERT INTO deck_cards (couple_id, kind, title, size, dedupe_key, batch, status, idea_id) VALUES ($1, 'idea', 'Kino unter Sternen', 'small', 'kino', 1, 'matched', $2)", [couple.id, ids["Kino unter Sternen"]]);

let failures = 0;
const check = (label, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
};
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

const KINDS = [
  ["alle", "alle.", IDEAS.length],
  ["match", "matchlinge.", 1],
  ["geswipt", "meine likes.", 2],
  ["small", "kurz.", IDEAS.filter((i) => i[1] === "small").length],
  ["large", "lang.", IDEAS.filter((i) => i[1] === "large").length],
  ["outdoor", "draußen.", IDEAS.filter((i) => i[3] === "outdoor").length],
  ["indoor", "drinnen.", IDEAS.filter((i) => i[3] === "indoor").length],
  ["local", "mit ort.", IDEAS.filter((i) => i[4]).length],
  ["own", "eigene.", IDEAS.filter((i) => i[5] === "wishlist").length],
];

/** What is on screen of the view: geometry of its parts, the tip, the rows. */
const measure = (page) =>
  page.evaluate(() => {
    const root = [...document.querySelectorAll("[data-category-view]")].find((el) => el.offsetParent !== null);
    const box = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
    const list = root.querySelector("ul[data-scroll]");
    const h1 = root.querySelector("h1");
    return {
      title: h1.textContent,
      h1: box(h1),
      h1Cut: h1.scrollWidth > h1.clientWidth + 1,
      h1Ellipsis: getComputedStyle(h1).textOverflow === "ellipsis",
      subtitle: box(root.querySelector("h1 + p")),
      subtitleText: root.querySelector("h1 + p").textContent,
      back: box(root.querySelector("[data-back]")),
      meta: [...root.querySelectorAll("span.meta")].filter((el) => getComputedStyle(el).position !== "absolute" && el.getBoundingClientRect().width > 2).map(box)[0] ?? null,
      bubble: box(root.querySelector("[data-bubble] p")),
      flower: box(root.querySelector('button[aria-label^="Blume"]')),
      chips: [...root.querySelectorAll('[role=group][aria-label=Filter] button')].map((b) => ({ text: b.textContent, pressed: b.getAttribute("aria-pressed") === "true" })),
      tip: root.querySelector("[data-tip]")?.querySelector("h2")?.textContent ?? null,
      tipWhen: root.querySelector("[data-tip-when]")?.textContent ?? null,
      tipBox: box(root.querySelector("[data-tip]")),
      rows: [...root.querySelectorAll("ul[data-scroll] ul > li a")].map((a) => a.querySelector("span span").textContent),
      groups: [...root.querySelectorAll("ul[data-scroll] h3")].map((h) => h.textContent),
      list: box(list),
      scrollable: list ? list.scrollHeight > list.clientHeight + 1 : false,
      nav: box(document.querySelector('nav[aria-label="Hauptmenü"]')),
      empty: Boolean(root.querySelector("[data-category-empty]")),
    };
  });
const meet = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;

for (const [width, height] of [
  [390, 844],
  [360, 740],
]) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, locale: "de-DE" });
  await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
  const j = await ctx.newPage();
  j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  const size = `${width}×${height}`;

  for (const [ansicht, title, total] of KINDS) {
    await j.goto(`${BASE}/ideas?ansicht=${ansicht}`);
    await j.locator("[data-category-view] [data-tip]").filter({ visible: true }).waitFor({ timeout: 20000 });
    await j.waitForTimeout(400);
    const m = await measure(j);
    check(`${size} ${title} head: title, "${m.subtitleText}"`, m.title === title && m.subtitleText.endsWith(`${total} ${total === 1 ? "Idee" : "Ideen"}`));
    const apart = [m.h1, m.subtitle, m.back, m.meta].every((b) => !meet(m.bubble, b)) && !meet(m.flower, m.subtitle) && !meet(m.bubble, m.flower);
    check(`${size} ${title} the bubble covers nothing (title, subtitle, back, flower)`, apart);
    check(`${size} ${title} the title fits or ends in an ellipsis`, !m.h1Cut || m.h1Ellipsis);
    check(`${size} ${title} the tip is not in the list; tip + rows = all (${m.rows.length + 1}/${total})`, m.tip && !m.rows.includes(m.tip) && m.rows.length + 1 === total);
    check(`${size} ${title} the list ends above the tab bar`, !m.list || m.list.bottom <= m.nav.top + 1);
    const { issues } = await layoutAudit(j);
    check(`${size} ${title} nothing overlaps or is cut off${issues.length ? `: ${issues.join("; ")}` : ""}`, issues.length === 0);
    await j.screenshot({ path: `${OUT}m31-${width}-${ansicht}.png` });

    // Every chip: pressed, its count = tip + rows
    for (const { text } of m.chips) {
      const label = text.replace(/\d+$/, "");
      const count = Number(text.match(/\d+$/)[0]);
      await j.locator("[data-category-view]").filter({ visible: true }).getByRole("group", { name: "Filter" }).getByRole("button", { name: new RegExp(`^${label}`) }).click();
      await j.waitForTimeout(250);
      const c = await measure(j);
      const pressed = c.chips.filter((x) => x.pressed).map((x) => x.text);
      check(`${size} ${title} chip „${label}“: pressed alone, ${count} = tip + rows (${c.rows.length + (c.tip ? 1 : 0)})`, pressed.length === 1 && pressed[0] === text && c.rows.length + (c.tip ? 1 : 0) === count && (!c.tip || !c.rows.includes(c.tip)));
      if (width === 390 && ansicht === "alle" && label !== "alle") await j.screenshot({ path: `${OUT}m31-390-alle-${label.replace(/\s/g, "-")}.png` });
    }
    check(`${size} ${title} chips without hits are hidden (${m.chips.map((c) => c.text).join(", ")})`, m.chips.every((c) => c.text.startsWith("alle") || !/\D0$/.test(c.text)));
  }

  // The long title: one line with an ellipsis, in the list and (when it is the tip) in the tip
  await j.goto(`${BASE}/ideas?ansicht=alle`);
  const longRow = j.getByRole("link", { name: new RegExp(`^${LONG.slice(0, 20)}`) }).filter({ visible: true });
  await longRow.waitFor({ timeout: 15000 });
  const cut = await longRow.locator("span span").first().evaluate((el) => ({ cut: el.scrollWidth > el.clientWidth, ellipsis: getComputedStyle(el).textOverflow === "ellipsis", h: el.getBoundingClientRect().height }));
  check(`${size} a long idea title: one line with an ellipsis (${JSON.stringify(cut)})`, cut.cut && cut.ellipsis && cut.h < 30);

  // The list scrolls cleanly under the header and above the tab bar
  const list = j.locator("[data-category-view] ul[data-scroll]").filter({ visible: true });
  const before = await measure(j);
  await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await j.waitForTimeout(300);
  const after = await list.evaluate((el) => {
    const last = [...el.querySelectorAll("ul > li a")].at(-1).getBoundingClientRect();
    return { top: el.scrollTop, lastBottom: last.bottom, listBottom: el.getBoundingClientRect().bottom };
  });
  check(`${size} "alle." scrolls (to ${after.top}), the last row stays above the tab bar (${Math.round(after.lastBottom)} ≤ ${Math.round(before.nav.top)})`, before.scrollable && after.top > 0 && after.lastBottom <= before.nav.top + 1 && after.lastBottom <= after.listBottom + 1);
  check(`${size} the page itself does not scroll`, await j.locator("main[data-screen]").filter({ visible: true }).evaluate((main) => main.scrollHeight <= main.clientHeight + 1));
  await j.screenshot({ path: `${OUT}m31-${width}-alle-unten.png` });
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "de-DE" });
await ctx.addCookies([{ name: "dom_session", value: jonas.token, url: BASE }]);
const j = await ctx.newPage();
j.on("pageerror", (e) => console.log("PAGEERROR", e.message));
const view = () => j.locator("[data-category-view]").filter({ visible: true });

// Groups, like badges, the tip prefers Sam's likes, "anderer ↻" goes round, the flower's quip
await j.goto(`${BASE}/ideas?ansicht=alle`);
await view().locator("[data-tip]").waitFor({ timeout: 20000 });
await j.waitForTimeout(500);
const m = await measure(j);
check(`groups: ✓ passt diese Woche / irgendwann (${m.groups.join(" | ")})`, m.groups.length >= 1 && m.groups.every((g) => /^(✓ passt diese Woche|irgendwann)\d+$/i.test(g)));
check(`the tip says when both are free (${m.tipWhen})`, /^[A-Z][a-z] \d{1,2}\.\d{1,2}\. · ab \d\d:\d\d · ✓ beide frei$/.test(m.tipWhen ?? ""));
check(`the tip is something Sam liked (${m.tip})`, ["Pizza backen", "Karaoke-Abend", "Kino unter Sternen"].includes(m.tip));
const kino = view().getByRole("link", { name: /^Kino unter Sternen/ });
const badges = m.tip === "Kino unter Sternen" ? null : await kino.getByRole("img").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
check(`a match shows both like badges (${badges})`, badges === null || (badges.includes("Jonas mag das") && badges.includes("Sam mag das")));
check("an own idea shows no like badge", (await view().getByRole("link", { name: /^Töpferkurs/ }).getByRole("img").count()) === 0);
const tips = [m.tip];
for (let n = 0; n < 3; n++) {
  await view().getByRole("button", { name: "anderer ↻" }).click();
  tips.push(await view().locator("[data-tip] h2").textContent());
}
check(`"anderer ↻" shows the next tip each time (${tips.join(" → ")})`, new Set(tips).size === 4);
const quip = await view().locator("[data-bubble] p").textContent();
await view().getByRole("button", { name: /^Blume antippen/ }).click();
check("tapping the flower: a new quip", (await view().locator("[data-bubble] p").textContent()) !== quip);
await j.screenshot({ path: `${OUT}m31-390-anderer.png` });

// A row opens the idea; back goes to the view
await view().getByRole("link", { name: /^Töpferkurs/ }).click();
await j.waitForURL(/idee=/, { timeout: 10000 });
await j.locator("main").getByRole("link", { name: "Zurück zur Liste" }).filter({ visible: true }).click();
await j.waitForURL(`${BASE}/ideas?ansicht=alle`, { timeout: 10000 });
check("a row opens the idea, back comes to the view", await view().locator("[data-tip]").isVisible());

// "Ins Beet pflanzen": "wann?" with the idea and the tip's evening picked
await j.goto(`${BASE}/ideas?ansicht=indoor`);
await view().locator("[data-tip]").waitFor({ timeout: 20000 });
const tipTitle = await view().locator("[data-tip] h2").textContent();
const href = await view().getByRole("link", { name: "Ins Beet pflanzen" }).getAttribute("href");
await view().getByRole("link", { name: "Ins Beet pflanzen" }).click();
await j.waitForURL(/\/plan\?idea=/, { timeout: 15000 });
const start = new URL(href, BASE).searchParams.get("start");
const picked = j.getByRole("list", { name: "Freie Zeiten" }).getByRole("button", { pressed: true });
await picked.waitFor({ timeout: 20000 });
const pickedStart = await picked.getAttribute("data-start");
check(`"Ins Beet pflanzen" opens "wann?" for „${tipTitle}“ with its evening picked (${start} = ${pickedStart})`, Boolean(start) && Date.parse(start) === Date.parse(pickedStart) && (await j.getByText(tipTitle).filter({ visible: true }).count()) > 0);
await j.screenshot({ path: `${OUT}m31-390-ins-beet.png` });

// Empty: nothing grows here
await db.query("UPDATE ideas SET archived_at = now() WHERE couple_id = $1 AND setting = 'outdoor'", [couple.id]);
await j.goto(`${BASE}/ideas?ansicht=outdoor`);
await view().locator("[data-category-empty]").waitFor({ timeout: 20000 });
check("empty: the sad flower and „hier wächst grad nix. anderer filter?“", await view().getByText("hier wächst grad nix. anderer filter?").isVisible());
await j.screenshot({ path: `${OUT}m31-390-leer.png` });

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
