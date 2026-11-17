import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
let day = "2026-11-20";
const { app, close } = createApp({
  password: "calendar-browser-test-password",
  secret: "calendar-browser-secret-at-least-32-characters",
  dbPath: ":memory:",
  today: () => day,
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
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 390, height: 844 } }),
    browser.newContext({ viewport: { width: 320, height: 844 } }),
  ]);
  const pages = [];
  const errors = [];
  for (const context of contexts) {
    const p = await context.newPage();
    pages.push(p);
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install({ time: new Date("2026-11-20T20:00:00Z") });
    await p.goto(base);
    await p
      .getByLabel("Haushaltspasswort")
      .fill("calendar-browser-test-password");
    await p.getByRole("button", { name: "Anmelden", exact: false }).click();
    await p.getByRole("heading", { name: "Nächste fünf Werktage" }).waitFor();
  }
  const [a, b] = pages;
  for (const name of ["Gnocchi-Gemüse-Pfanne", "Zitroniger Couscous"]) {
    await a.getByRole("button", { name: "＋ Gericht wählen" }).first().click();
    await a.getByRole("button", { name: new RegExp(name) }).click();
    await a.getByRole("button", { name, exact: true }).waitFor();
  }
  await a
    .getByRole("button", { name: /Einkauf/ })
    .last()
    .click();
  async function add(name, category) {
    await a.getByLabel("Artikel", { exact: true }).fill(name);
    await a.getByLabel("Kategorie", { exact: true }).selectOption(category);
    await a.getByRole("button", { name: "Hinzufügen", exact: true }).click();
    await a.locator(".shopping-entry").filter({ hasText: name }).waitFor();
  }
  await add("Kaffee", "Vorrat");
  await add("Spülmittel", "Haushalt");
  const soap = a.locator(".shopping-entry").filter({ hasText: "Spülmittel" });
  await soap.getByRole("checkbox").check();
  await a
    .getByLabel("Kategorie für Kaffee", { exact: true })
    .selectOption("Getränke");
  await a
    .locator(".shopping-groups section")
    .filter({ has: a.getByRole("heading", { name: "Getränke", exact: true }) })
    .getByText("Kaffee", { exact: true })
    .waitFor();
  await add("<img src=x onerror=window.xss=true>", "Sonstiges");
  assert.equal(await a.evaluate(() => window.xss), undefined);
  await a
    .getByRole("button", {
      name: "<img src=x onerror=window.xss=true> löschen",
      exact: true,
    })
    .click();
  await a
    .getByText("<img src=x onerror=window.xss=true>", { exact: true })
    .waitFor({ state: "hidden" });
  await b
    .getByRole("button", { name: /Einkauf/ })
    .last()
    .click();
  await b.evaluate(() => window.dispatchEvent(new Event("focus")));
  await b
    .locator(".shopping-entry")
    .filter({ hasText: "Spülmittel" })
    .waitFor();
  assert(
    await b
      .locator(".shopping-entry")
      .filter({ hasText: "Spülmittel" })
      .getByRole("checkbox")
      .isChecked(),
  );
  async function advance(date, instant) {
    day = date;
    for (const p of pages) {
      await p.clock.setSystemTime(new Date(instant));
      await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    }
  }
  await advance("2026-11-21", "2026-11-20T23:01:00Z");
  for (const p of pages) {
    await p
      .getByText("Spülmittel", { exact: true })
      .waitFor({ state: "hidden" });
    await p.getByText("Kaffee", { exact: true }).waitFor();
    await p.getByText("Gnocchi", { exact: true }).waitFor({ state: "hidden" });
    assert.match(
      await p
        .locator(".shopping-row")
        .filter({ hasText: "Feta" })
        .textContent(),
      /150 g/,
    );
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await a
    .locator(".shopping-entry")
    .filter({ hasText: "Kaffee" })
    .getByRole("checkbox")
    .check();
  await advance("2026-11-22", "2026-11-21T23:01:00Z");
  await a.getByText("Kaffee", { exact: true }).waitFor({ state: "hidden" });
  await a.getByRole("button", { name: "Plan", exact: true }).click();
  assert.equal(await a.locator(".day").count(), 5);
  assert.equal(
    await a.locator(".day").first().locator(".day-date strong").textContent(),
    "Mo",
  );
  const snapshot = await (
    await contexts[0].request.get(base + "/api/state")
  ).json();
  assert.deepEqual(snapshot.state.plan, { "2026-11-23": "couscous" });
  assert.equal(snapshot.state.manualItems.length, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: manual add/category/reassign/check/delete/XSS escaping and two-device sync; Friday→Saturday recipe cleanup; open items survive; Saturday→Sunday bought-item cleanup even with unchanged workdays; 320/390px layout.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  close();
}
