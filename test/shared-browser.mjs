import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const { app, close } = createApp({
  password: "browser-test-password-only",
  secret: "browser-test-secret-over-32-characters",
  dbPath: ":memory:",
});
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FUTTER_CHROMIUM
    ? { executablePath: process.env.FUTTER_CHROMIUM }
    : {}),
});
try {
  const first = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    second = await browser.newContext();
  const [a, b] = await Promise.all([first.newPage(), second.newPage()]);
  for (const page of [a, b]) {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page
      .getByLabel("Haushaltspasswort")
      .fill("browser-test-password-only");
    await page.getByRole("button", { name: "Anmelden", exact: false }).click();
    await page.getByRole("heading", { name: "Nächste fünf Werktage" }).waitFor();
  }
  await a.getByRole("button", { name: "＋ Gericht wählen" }).first().click();
  await a.getByRole("button", { name: /Gnocchi-Gemüse-Pfanne/ }).click();
  await a
    .getByRole("button", { name: "Gnocchi-Gemüse-Pfanne", exact: true })
    .waitFor();
  await b
    .getByRole("button", { name: "Gnocchi-Gemüse-Pfanne", exact: true })
    .waitFor({ timeout: 15000 });
  await a
    .getByRole("button", { name: /Einkauf/ })
    .last()
    .click();
  await a
    .locator(".shopping-row")
    .filter({ hasText: "Feta" })
    .getByRole("checkbox")
    .check();
  await b
    .getByRole("button", { name: /Einkauf/ })
    .last()
    .click();
  await b.waitForFunction(
    () =>
      [...document.querySelectorAll(".shopping-row")].some(
        (e) =>
          e.textContent.includes("Feta") && e.querySelector("input").checked,
      ),
    {},
    { timeout: 15000 },
  );
  await a.getByRole("button", { name: "Abmelden", exact: true }).click();
  await a.getByLabel("Haushaltspasswort").waitFor();
  assert.equal(
    (
      await a.request.get(`http://127.0.0.1:${server.address().port}/api/state`)
    ).status(),
    401,
  );
  console.log(
    "PASS: two private sessions share dinner plan and shopping checks; logout revokes access.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  close();
}
