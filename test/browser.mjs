import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.FUTTER_CHROMIUM
    ? { executablePath: process.env.FUTTER_CHROMIUM }
    : {}),
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.FUTTER_TEST_URL || "http://127.0.0.1:5174");
  await page.getByRole("heading", { name: "Eure nächsten Abende" }).waitFor();
  assert.equal(await page.locator(".day").count(), 5);
  await page.getByRole("button", { name: "＋ Gericht wählen" }).first().click();
  await page.getByRole("button", { name: /Gnocchi-Gemüse-Pfanne/ }).click();
  await page.getByRole("button", { name: "＋ Gericht wählen" }).first().click();
  await page.getByRole("button", { name: /Zitroniger Couscous/ }).click();
  await page
    .getByRole("button", { name: /Einkauf/, exact: false })
    .last()
    .click();
  const feta = page.locator(".shopping-row").filter({ hasText: "Feta" });
  assert.match(await feta.textContent(), /300 g/);
  await feta.getByRole("checkbox").check();
  await page.reload();
  await page.getByRole("heading", { name: "Eure nächsten Abende" }).waitFor();
  await page
    .getByRole("button", { name: /Einkauf/ })
    .last()
    .click();
  assert(
    await page
      .locator(".shopping-row")
      .filter({ hasText: "Feta" })
      .getByRole("checkbox")
      .isChecked(),
  );
  await page.getByRole("button", { name: "Rezepte", exact: true }).click();
  await page.getByRole("searchbox").fill("Erdnuss");
  assert.equal(await page.locator(".recipe-card").count(), 1);
  await page.locator(".recipe-card").click();
  await page.getByRole("heading", { name: "So geht’s" }).waitFor();
  assert(
    await page
      .locator("dialog")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  );
  await page.getByRole("button", { name: "Dialog schließen" }).click();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `horizontal overflow at ${width}`,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mein Plan", exact: true }).click();
  await page.screenshot({ path: "/tmp/futter-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: mobile plan → recipe → quantities → checked persistence; search; dialog; no overflow at 320/390/768/1280px.",
  );
} finally {
  await browser.close();
}
