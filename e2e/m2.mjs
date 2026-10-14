// M2 end-to-end check: wishlist with two logged-in partners.
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SHOTS = new URL("./shots/", import.meta.url).pathname;
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("TRUNCATE users, couples, sessions, ideas CASCADE");

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
const card = (page, title) => page.locator("li").filter({ has: page.getByRole("button", { name: title, exact: true }) });

const a = await pageFor(tokenA);
const b = await pageFor(tokenB);
await a.goto(`${BASE}/ideas`);
await b.goto(`${BASE}/ideas`);
check("empty state on a fresh wishlist", (await a.getByText("Noch keine Ideen").count()) > 0);
await a.screenshot({ path: `${SHOTS}m2-01-empty.png` });

// Quick add: tap +, type, Enter
const started = Date.now();
await a.getByRole("button", { name: "Idee hinzufügen" }).click();
await a.getByLabel("Was wollt ihr machen?").first().waitFor();
check("title field is focused right away", await a.evaluate(() => document.activeElement?.getAttribute("name") === "title"));
await a.screenshot({ path: `${SHOTS}m2-02-quick-add.png` });
await a.keyboard.type("Picknick im Stadtwald");
await a.keyboard.press("Enter");
await a.getByText("Auf eurer Wunschliste!").waitFor({ timeout: 5000 });
const quickAddMs = Date.now() - started;
check(`quick add round trip (tap → saved) in ${quickAddMs} ms`, quickAddMs < 3000);
await card(a, "Picknick im Stadtwald").waitFor({ timeout: 5000 });
check("own list shows the new idea without reload", (await card(a, "Picknick im Stadtwald").count()) === 1);
check("sheet closed after saving", !(await a.locator("dialog[open]").count()));

// Partner sees it without touching anything
const seenStart = Date.now();
await card(b, "Picknick im Stadtwald").waitFor({ timeout: 20000 }).catch(() => {});
const seenMs = Date.now() - seenStart;
check(`partner sees the idea automatically (after ${Math.round(seenMs / 1000)} s)`, (await card(b, "Picknick im Stadtwald").count()) === 1);
check("partner sees who added it (avatar J)", (await card(b, "Picknick im Stadtwald").getByTitle("Jonas").count()) === 1);

// Large idea with all details
await a.getByRole("button", { name: "Idee hinzufügen" }).click();
await a.getByLabel("Was wollt ihr machen?").first().fill("Wandern im Siebengebirge");
await a.locator("dialog[open]").getByText("Lang").click();
await a.locator("dialog[open]").getByText("Mehr Details").click();
await a.locator("dialog[open]").getByLabel("Notiz").fill("Proviant einpacken");
await a.locator("dialog[open]").getByLabel("Link").fill("siebengebirge.de");
await a.locator("dialog[open]").getByLabel("Kosten (€)").fill("20");
await a.locator("dialog[open]").getByLabel("Ort").fill("Königswinter");
await a.locator("dialog[open]").getByRole("button", { name: "Speichern" }).click();
await card(a, "Wandern im Siebengebirge").waitFor({ timeout: 5000 });
const bigCard = await card(a, "Wandern im Siebengebirge").innerText();
check("details show on the card", ["Lang", "~20 €", "Königswinter", "siebengebirge.de", "Proviant"].every((t) => bigCard.includes(t)));
const link = await card(a, "Wandern im Siebengebirge").getByRole("link").getAttribute("href");
check("link was normalized to https", link === "https://siebengebirge.de/");

// Validation keeps the input
await a.getByRole("button", { name: "Idee hinzufügen" }).click();
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
await card(b, "Picknick im Stadtwald").getByRole("button").first().click();
const editSheet = b.locator("dialog[open]");
await editSheet.getByLabel("Was wollt ihr machen?").waitFor();
await editSheet.getByLabel("Was wollt ihr machen?").fill("Picknick im Stadtwald mit Frisbee");
await editSheet.getByRole("button", { name: "Speichern" }).click();
await card(b, "Picknick im Stadtwald mit Frisbee").waitFor({ timeout: 5000 });
check("partner can edit any idea", (await card(b, "Picknick im Stadtwald mit Frisbee").count()) === 1);
await card(b, "Picknick im Stadtwald mit Frisbee").getByRole("button").first().click();
await b.locator("dialog[open]").getByText("zuletzt geändert von Sam").waitFor({ timeout: 5000 }).catch(() => {});
check("edit sheet shows creator and last editor", (await b.locator("dialog[open]").getByText("Eingetragen von Jonas · zuletzt geändert von Sam").count()) === 1);
await b.screenshot({ path: `${SHOTS}m2-04-edit.png` });

// Delete
await b.locator("dialog[open]").getByRole("button", { name: "Idee löschen" }).click();
await b.locator("dialog[open]").getByRole("button", { name: "Ja, löschen" }).click();
await card(b, "Picknick im Stadtwald mit Frisbee").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
check("deleting removes the idea", (await card(b, "Picknick im Stadtwald mit Frisbee").count()) === 0);
const { rows: archived } = await db.query("SELECT count(*)::int AS n FROM ideas WHERE archived_at IS NOT NULL");
check("delete is a soft delete (archived_at set)", archived[0].n === 1);

// Filter
for (const [title, size] of [["Ramen selbst kochen", "Kurz"], ["Bouldern ausprobieren", "Kurz"]]) {
  await b.getByRole("button", { name: "Idee hinzufügen" }).click();
  await b.getByLabel("Was wollt ihr machen?").first().fill(title);
  await b.locator("dialog[open]").getByText(size).click();
  await b.keyboard.press("Enter");
  await card(b, title).waitFor({ timeout: 5000 });
}
await b.getByRole("button", { name: /Lang · 1/ }).click();
check("filter shows only large ideas", (await b.locator("li").filter({ hasText: "Ramen" }).count()) === 0 && (await card(b, "Wandern im Siebengebirge").count()) === 1);
await b.getByRole("button", { name: "Alle" }).click();
await b.waitForTimeout(400);
await b.screenshot({ path: `${SHOTS}m2-05-list.png` });

// Home teaser + dark mode
const dark = await pageFor(tokenA, "dark");
await dark.goto(`${BASE}/ideas`);
await card(dark, "Ramen selbst kochen").waitFor();
await dark.waitForTimeout(400);
await dark.screenshot({ path: `${SHOTS}m2-06-list-dark.png` });
await a.goto(`${BASE}/`);
await a.getByText("auf eurer Wunschliste").waitFor({ timeout: 10000 });
check("home shows the wishlist count", (await a.locator("a", { hasText: "auf eurer Wunschliste" }).innerText()).includes("3 Ideen"));
await a.screenshot({ path: `${SHOTS}m2-07-home.png` });

await browser.close();
await db.end();
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
