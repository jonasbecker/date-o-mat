// The planning flow on /plan: step 1 "Was wollt ihr machen?" (tap an idea),
// step 2 "Wann?" (the free times, an <ol> of buttons).

/** Taps an idea on the wishlist of step 1 and waits for the free times. */
export async function pickIdea(page, title, { timeout = 15000 } = {}) {
  // exact: each card also has an "… bearbeiten" button (⋯).
  await page.getByRole("list", { name: "Eure Wunschliste" }).getByRole("button", { name: title, exact: true }).click({ timeout });
  await page.locator("ol li button").first().waitFor({ timeout });
}

/** Opens /plan and goes on with the first (longest waiting) idea of the list. */
export async function openTimes(page, base, query = "") {
  await page.goto(`${base}/plan${query}`);
  const first = page.getByRole("list", { name: "Eure Wunschliste" }).getByRole("button", { name: /^(?!.* bearbeiten$)/ }).first();
  await first.click({ timeout: 20000 });
  await page.locator("ol li button").first().waitFor({ timeout: 20000 });
}

/** Step 1 with your own idea: "Was anderes" → type it → "Weiter →". */
export async function customIdea(page, title, location) {
  await page.getByRole("button", { name: "Was anderes" }).click();
  const sheet = page.locator("dialog[open]");
  await sheet.getByLabel("Eure eigene Idee").fill(title);
  if (location) await sheet.getByLabel("Ort (optional)").fill(location);
  await sheet.getByRole("button", { name: "Weiter →" }).click();
  await page.locator("ol li button").first().waitFor({ timeout: 15000 });
}

/** All free times of step 2 – three per page, "Weitere Zeiten →" turns the page. */
export async function allSlotItems(page) {
  const items = [];
  for (let i = 0; i < 10; i++) {
    items.push(...(await page.locator("ol li").evaluateAll((lis) => lis.map((li) => li.outerHTML))));
    const more = page.getByRole("button", { name: "Weitere Zeiten →" });
    if (!(await more.isVisible())) break;
    await more.click();
  }
  return items;
}

/** The screen fits: the page itself does not scroll (only lists inside may). */
export async function fitsScreen(page) {
  return page.locator("main[data-screen]").evaluate((main) => main.scrollHeight <= main.clientHeight + 1);
}

/** After "Date festlegen" / "Termin ändern": back on the start page, which shows the date. */
export async function backAtStart(page, base) {
  await page.waitForURL(`${base}/plan`, { timeout: 20000 });
  await page.getByRole("button", { name: /^(Date festlegen 🎉|Termin ändern)$/ }).waitFor({ state: "hidden", timeout: 20000 });
  await page.locator("[data-date-card]").filter({ visible: true }).first().waitFor({ timeout: 20000 });
}
