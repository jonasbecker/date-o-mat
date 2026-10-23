// M2 end-to-end check: wishlist with two logged-in partners.
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium } from "playwright";
import { resetDb } from "./db.mjs";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await resetDb(db, "users, couples, sessions, ideas");

const { rows: [couple] } = await db.query("INSERT INTO couples DEFAULT VALUES RETURNING id");
async function makeUser(name, email, color) {
  const { rows } = await db.query(
    "INSERT INTO users (google_sub, email, name, couple_id, color, onboarded_at) VALUES ($1, $2, $3, $4, $5, now()) RETURNING id",
    [`sub-${email}`, email, name, couple.id, color],
  );
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 day')", [hash, rows[0].id]);
  return token;
}
const tokenA = await makeUser("Jonas", "jonas@example.com", "mandarine");
const tokenB = await makeUser("Sam", "partnerin@example.com", "himmel");
await db.query("INSERT INTO couple_settings (couple_id) VALUES ($1)", [couple.id]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function pageFor(token, colorScheme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme });
  await ctx.addCookies([{ name: "dom_session", value: token, url: BASE }]);
  return ctx.newPage();
}

let failures = 0;
function check(label, ok) {
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) failures++;
}
// An idea in a tile's view: the flower's tip or a row of the list (the tip is not listed again).
const view = (page) => page.locator("[data-category-view]").filter({ visible: true });
const card = (page, title) => view(page).locator("[data-tip], li:has(> a)").filter({ has: page.getByRole("link", { name: new RegExp(`^${title}`) }) });
const open = async (page, title) => {
  await card(page, title).getByRole("link", { name: new RegExp(`^${title}`) }).first().click();
  await page.waitForURL(/[?&]idee=/, { timeout: 10000 });
};
// Ideas are added on the shelf (the tiles), the views only show them.
const add = async (page) => {
  if (!page.url().endsWith("/ideas")) await page.goto(`${BASE}/ideas`);
  await page.getByRole("button", { name: "Idee hinzufügen" }).click();
};

const a = await pageFor(tokenA);
const b = await pageFor(tokenB);
await a.goto(`${BASE}/ideas?ansicht=alle`);
await b.goto(`${BASE}/ideas?ansicht=alle`);
check("empty state on a fresh wishlist", await a.getByText("hier wächst grad nix. anderer filter?").isVisible({ timeout: 15000 }).catch(() => false));
await a.screenshot({ path: `${SHOTS}m2-01-empty.png` });

// Quick add: tap +, type, Enter
await a.goto(`${BASE}/ideas`);
await a.waitForTimeout(800); // hydration
const started = Date.now();
await add(a);
await a.getByLabel("Was wollt ihr machen?").first().waitFor();
check("title field is focused right away", await a.evaluate(() => document.activeElement?.getAttribute("name") === "title"));
await a.screenshot({ path: `${SHOTS}m2-02-quick-add.png` });
await a.keyboard.type("Picknick im Stadtwald");
await a.keyboard.press("Enter");
await a.getByText("Auf eurer Wunschliste!").waitFor({ timeout: 5000 });
const quickAddMs = Date.now() - started;
check(`quick add round trip (tap → saved) in ${quickAddMs} ms`, quickAddMs < 3000);
await a.getByRole("link", { name: "Alle 1 ›" }).waitFor({ timeout: 5000 });
check("the shelf counts the new idea without reload", await a.getByRole("link", { name: "Alle 1 ›" }).isVisible());
check("sheet closed after saving", !(await a.locator("dialog[open]").count()));

// Partner sees it without touching anything
const seenStart = Date.now();
await card(b, "Picknick im Stadtwald").waitFor({ timeout: 20000 }).catch(() => {});
const seenMs = Date.now() - seenStart;
check(`partner sees the idea automatically (after ${Math.round(seenMs / 1000)} s)`, (await card(b, "Picknick im Stadtwald").count()) === 1);

// Large idea with all details
await add(a);
await a.getByLabel("Was wollt ihr machen?").first().fill("Wandern im Siebengebirge");
await a.locator("dialog[open]").getByText("Lang").click();
await a.locator("dialog[open]").getByText("Mehr Details").click();
await a.locator("dialog[open]").getByLabel("Notiz").fill("Proviant einpacken");
await a.locator("dialog[open]").getByLabel("Link").fill("siebengebirge.de");
await a.locator("dialog[open]").getByLabel("Kosten (€)").fill("20");
await a.locator("dialog[open]").getByLabel("Ort").fill("Königswinter");
await a.locator("dialog[open]").getByRole("button", { name: "Speichern" }).click();
await a.getByText("Auf eurer Wunschliste!").waitFor({ timeout: 5000 });
await a.goto(`${BASE}/ideas?ansicht=alle`);
await card(a, "Wandern im Siebengebirge").waitFor({ timeout: 10000 });
const bigCard = (await card(a, "Wandern im Siebengebirge").innerText()).toLowerCase();
check(`how long, cost and place show on the card (${bigCard.replace(/\s+/g, " ")})`, ["halber tag", "~20 €", "königswinter"].every((t) => bigCard.includes(t)));
await open(a, "Wandern im Siebengebirge");
await a.getByRole("heading", { name: "Wandern im Siebengebirge", exact: true }).waitFor({ timeout: 10000 });
const detail = await a.locator("main").filter({ visible: true }).innerText();
check("the idea's page shows note and link", detail.includes("Proviant") && detail.includes("siebengebirge.de"));
const link = await a.locator("main").getByRole("link", { name: /siebengebirge\.de/ }).getAttribute("href");
check("link was normalized to https", link === "https://siebengebirge.de/");

// Validation keeps the input
await add(a);
await a.getByLabel("Was wollt ihr machen?").first().fill("Kino");
await a.locator("dialog[open]").getByText("Mehr Details").click();
await a.locator("dialog[open]").getByLabel("Link").fill("javascript:alert(1)");
await a.locator("dialog[open]").getByRole("button", { name: "Speichern" }).click();
await a.locator("dialog[open]").getByText("Das sieht nicht nach einem Link aus.").waitFor({ timeout: 5000 });
check("invalid link is rejected with a message", true);
check("typed title survives the error", (await a.locator("dialog[open]").getByLabel("Was wollt ihr machen?").inputValue()) === "Kino");
await a.screenshot({ path: `${SHOTS}m2-03-validation.png` });
await a.keyboard.press("Escape");

// Partner edits Jonas' idea
await b.reload();
await card(b, "Picknick im Stadtwald").waitFor({ timeout: 10000 });
await open(b, "Picknick im Stadtwald");
// Tapping an idea opens it on the whole screen: everything about it, planning and editing at the bottom.
await b.getByRole("heading", { name: "Picknick im Stadtwald", exact: true }).waitFor({ timeout: 10000 });
check("tapping an idea opens it full screen (in the URL)", /[?&]idee=/.test(b.url()));
check("tapping an idea offers planning and editing", await b.locator("main").getByRole("link", { name: "Date damit planen" }).isVisible());
await b.screenshot({ path: `${SHOTS}m2-03b-idea.png` });
await b.locator("main").getByRole("button", { name: "Bearbeiten" }).click();
const editSheet = b.locator("dialog[open]");
await editSheet.getByLabel("Was wollt ihr machen?").waitFor();
await editSheet.getByLabel("Was wollt ihr machen?").fill("Picknick im Stadtwald mit Frisbee");
await editSheet.getByRole("button", { name: "Speichern" }).click();
await b.getByRole("heading", { name: "Picknick im Stadtwald mit Frisbee", exact: true }).waitFor({ timeout: 5000 });
await b.getByRole("link", { name: "Zurück zur Liste" }).click();
await card(b, "Picknick im Stadtwald mit Frisbee").waitFor({ timeout: 5000 });
check("partner can edit any idea", (await card(b, "Picknick im Stadtwald mit Frisbee").count()) === 1);
await open(b, "Picknick im Stadtwald mit Frisbee");
await b.locator("main").getByRole("button", { name: "Bearbeiten" }).click();
await b.locator("dialog[open]").getByText("zuletzt geändert von Sam").waitFor({ timeout: 5000 }).catch(() => {});
check("edit sheet shows creator and last editor", (await b.locator("dialog[open]").getByText("Eingetragen von Jonas · zuletzt geändert von Sam").count()) === 1);
await b.screenshot({ path: `${SHOTS}m2-04-edit.png` });

// Delete
await b.locator("dialog[open]").getByRole("button", { name: "Idee löschen" }).click();
await b.locator("dialog[open]").getByRole("button", { name: "Ja, löschen" }).click();
await card(b, "Picknick im Stadtwald mit Frisbee").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
check("deleting removes the idea", (await card(b, "Picknick im Stadtwald mit Frisbee").count()) === 0);
// The list updates at once (optimistic) – the server may still be on it.
let archivedCount = 0;
for (let i = 0; i < 40 && archivedCount === 0; i++) {
  archivedCount = (await db.query("SELECT count(*)::int AS n FROM ideas WHERE archived_at IS NOT NULL")).rows[0].n;
  if (archivedCount === 0) await new Promise((r) => setTimeout(r, 250));
}
check("delete is a soft delete (archived_at set)", archivedCount === 1);

// The view's chips filter tip and list
for (const [title, size] of [["Ramen selbst kochen", "Kurz"], ["Bouldern ausprobieren", "Kurz"]]) {
  await add(b);
  await b.getByLabel("Was wollt ihr machen?").first().fill(title);
  await b.locator("dialog[open]").getByText(size).click();
  await b.keyboard.press("Enter");
  await b.getByText("Auf eurer Wunschliste!").waitFor({ timeout: 5000 });
}
await b.goto(`${BASE}/ideas?ansicht=alle`);
await card(b, "Ramen selbst kochen").waitFor({ timeout: 10000 });
await view(b).getByRole("group", { name: "Filter" }).getByRole("button", { name: /^ein Abend/ }).click();
check("the chip „ein Abend“ shows only the short ideas", (await card(b, "Wandern im Siebengebirge").count()) === 0 && (await card(b, "Ramen selbst kochen").count()) === 1 && (await card(b, "Bouldern ausprobieren").count()) === 1);
check("the chip is pressed", (await view(b).getByRole("button", { name: /^ein Abend/ }).getAttribute("aria-pressed")) === "true");
await view(b).getByRole("button", { name: /^alle/ }).click();
await card(b, "Wandern im Siebengebirge").waitFor({ timeout: 5000 });
await b.waitForTimeout(400);
await b.screenshot({ path: `${SHOTS}m2-05-list.png` });

// Dark (the app is dark only) + the shelf's count
const dark = await pageFor(tokenA, "dark");
await dark.goto(`${BASE}/ideas?ansicht=alle`);
await card(dark, "Ramen selbst kochen").waitFor();
await dark.waitForTimeout(400);
await dark.screenshot({ path: `${SHOTS}m2-06-list-dark.png` });
await dark.goto(`${BASE}/ideas`);
check("the header shows the count", await dark.getByText("3 Samen im Regal").waitFor({ timeout: 10000 }).then(() => true, () => false));
await a.goto(`${BASE}/plan`);
await a.getByRole("heading", { name: "Date planen" }).waitFor({ timeout: 10000 });
await a.screenshot({ path: `${SHOTS}m2-07-home.png` });

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
