// The planning flow on /plan: step 1 "Was wollt ihr machen?" (tap an idea),
// step 2 "Wann?" (the free times, an <ol> of buttons).

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Taps an idea on the wishlist of step 1 and waits for the free times. */
export async function pickIdea(page, title, { timeout = 15000 } = {}) {
  await page.getByRole("list", { name: "Eure Wunschliste" }).getByRole("button", { name: new RegExp(`^${escape(title)}`) }).click({ timeout });
  await page.locator("ol li button").first().waitFor({ timeout });
}

/** Opens /plan and goes on with the first (longest waiting) idea of the list. */
export async function openTimes(page, base, query = "") {
  await page.goto(`${base}/plan${query}`);
  const first = page.getByRole("list", { name: "Eure Wunschliste" }).getByRole("button").first();
  await first.click({ timeout: 20000 });
  await page.locator("ol li button").first().waitFor({ timeout: 20000 });
}

/** Step 1 with your own idea: type it, "Weiter →". */
export async function customIdea(page, title) {
  await page.getByLabel("Oder eure eigene Idee").fill(title);
  await page.getByRole("button", { name: "Weiter →" }).click();
  await page.locator("ol li button").first().waitFor({ timeout: 15000 });
}

/** After "Date festlegen" / "Termin ändern": back on the start page, which shows the date. */
export async function backAtStart(page, base) {
  await page.waitForURL(`${base}/plan`, { timeout: 20000 });
  await page.getByRole("button", { name: /^(Date festlegen 🎉|Termin ändern)$/ }).waitFor({ state: "hidden", timeout: 20000 });
  await page.locator("[data-date-card]").filter({ visible: true }).first().waitFor({ timeout: 20000 });
}
