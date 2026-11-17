import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const { app, close } = createApp({
  password: "recipe-test-password-only",
  secret: "recipe-test-secret-at-least-32-characters",
  dbPath: ":memory:",
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FUTTER_CHROMIUM
    ? { executablePath: process.env.FUTTER_CHROMIUM }
    : {}),
});
try {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function login(p) {
    await p.goto(base);
    await p.getByLabel("Haushaltspasswort").fill("recipe-test-password-only");
    await p.getByRole("button", { name: "Anmelden", exact: false }).click();
    await p.getByRole("heading", { name: "Nächste fünf Werktage" }).waitFor();
  }
  await login(page);
  await page.getByRole("button", { name: "Rezepte", exact: true }).click();
  assert.equal(await page.locator(".recipe-card").count(), 12);
  for (const name of [
    "Griechischer Salat",
    "Linsensalat",
    "Hummus-Pilz-Schinken Baguette",
    "Asia-Rote Linsen",
  ]) {
    await page.getByRole("searchbox").fill(name);
    assert.equal(await page.locator(".recipe-card").count(), 1);
  }
  await page.locator(".recipe-card").click();
  assert.equal(await page.locator("dialog .ingredients li").count(), 2);
  assert.match(
    await page.locator("dialog .ingredients").textContent(),
    /Asiagemüse mit Kokos.*1 Tüte.*Rote Linsen.*1 Packung/,
  );
  await page.getByRole("button", { name: "Dialog schließen" }).click();
  await page.getByRole("searchbox").fill("Griechischer Salat");
  await page.locator(".recipe-card").click();
  assert.equal(
    await page
      .getByRole("heading", { name: "Zubereitung", exact: true })
      .count(),
    0,
  );
  await page
    .getByRole("button", { name: "Zutaten bearbeiten", exact: true })
    .click();
  await page.getByLabel("Menge 1", { exact: true }).fill("2,5");
  await page
    .locator("#ingredient-name-0")
    .fill("Gurke <img src=x onerror=window.xss=true>");
  await page
    .getByRole("button", { name: "Zutat hinzufügen", exact: true })
    .click();
  const last = page.locator(".ingredient-editor fieldset").last();
  await last.getByLabel("Name", { exact: true }).fill("Zusatz");
  await last.getByRole("button", { name: "Zutat entfernen" }).click();
  await page
    .getByRole("button", { name: "Zutaten speichern", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Zutaten bearbeiten", exact: true })
    .waitFor();
  assert.match(
    await page.locator("dialog .ingredients li").first().textContent(),
    /2,5 Stück/,
  );
  assert.equal(await page.locator("dialog img").count(), 0);
  assert.equal(await page.evaluate(() => window.xss), undefined);
  await page
    .getByRole("button", { name: "Für diesen Tag einplanen", exact: false })
    .click();
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  await page
    .getByRole("button", { name: "Griechischer Salat", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: /Einkauf/ })
    .last()
    .click();
  assert.match(
    await page
      .locator(".shopping-row")
      .filter({ hasText: "Gurke" })
      .textContent(),
    /2,5 Stück/,
  );
  await page.getByRole("button", { name: "SNAAACKS!", exact: true }).click();
  for (const name of [
    "Kekse",
    "Schokobons",
    "Chips",
    "Nüsse",
    "Schoki",
    "Salat",
  ])
    assert.equal(await page.getByLabel(name, { exact: true }).count(), 1);
  await page.getByLabel("Kekse", { exact: true }).check();
  await page.getByLabel("Salat", { exact: true }).check();
  await page
    .getByRole("button", { name: "Zur Einkaufsliste hinzufügen", exact: true })
    .click();
  await page.getByText("Kekse", { exact: true }).waitFor();
  await page.getByText("Salat", { exact: true }).waitFor();
  const snapshot = await (
    await context.request.get(base + "/api/state")
  ).json();
  assert.equal(
    snapshot.state.ingredientOverrides["greek-salad"][0].quantity,
    2.5,
  );
  assert.deepEqual(
    snapshot.state.manualItems.map((i) => [i.name, i.category]),
    [
      ["Kekse", "Vorrat"],
      ["Salat", "Gemüse & Obst"],
    ],
  );
  const other = await browser.newContext();
  const b = await other.newPage();
  await login(b);
  await b
    .getByRole("button", { name: "Griechischer Salat", exact: true })
    .click();
  assert.match(
    await b.locator("dialog .ingredients li").first().textContent(),
    /2,5 Stück/,
  );
  await other.close();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 4 new recipes, no cooking instructions, editable/persisted/shared ingredients, updated shopping quantities, snack selector/list/categories and mobile layout.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  close();
}
