import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nextWorkdays,
  localDate,
  shopping,
  emptyState,
  setDish,
  checkKey,
  validateState,
} from "../src/core.js";
import { recipes } from "../src/recipes.js";
test("five workdays include today, skip weekends and cross year boundaries", () => {
  assert.deepEqual(nextWorkdays("2026-11-20"), [
    "2026-11-20",
    "2026-11-23",
    "2026-11-24",
    "2026-11-25",
    "2026-11-26",
  ]);
  assert.equal(nextWorkdays("2026-11-21")[0], "2026-11-23");
  assert.deepEqual(nextWorkdays("2026-12-31"), [
    "2026-12-31",
    "2027-01-01",
    "2027-01-04",
    "2027-01-05",
    "2027-01-06",
  ]);
  assert.equal(localDate(new Date("2026-11-15T23:30:00Z")), "2026-11-16");
});
test("ingredients aggregate across selected dates only, even when recipe repeats", () => {
  const dates = nextWorkdays("2026-11-16"),
    s = emptyState();
  s.plan[dates[0]] = "gnocchi";
  s.plan[dates[1]] = "couscous";
  s.plan["2026-11-23"] = "gnocchi";
  assert.equal(shopping(s, dates).find((i) => i.name === "Feta").quantity, 300);
  s.plan[dates[1]] = "gnocchi";
  assert.equal(
    shopping(s, dates).find((i) => i.name === "Gnocchi").quantity,
    800,
  );
  assert.equal(shopping(emptyState(), dates).length, 0);
});
test("increased shopping demand and rolling dates reset checked status", () => {
  const dates = nextWorkdays("2026-11-16");
  let s = setDish(emptyState(), dates[0], "gnocchi", dates);
  const feta = shopping(s, dates).find((i) => i.name === "Feta");
  s.checked = [checkKey(feta, dates)];
  s = setDish(s, dates[1], "couscous", dates);
  assert.equal(s.checked.length, 0);
  const item = shopping(s, dates)[0];
  s.checked = [checkKey(item, dates)];
  assert.notEqual(checkKey(item, nextWorkdays("2026-11-17")), s.checked[0]);
  s = setDish(s, dates[0], null, dates);
  assert.equal(s.plan[dates[0]], null);
});
test("all sample recipes have ingredients and steps and take no more than 30 minutes", () => {
  for (const r of recipes) {
    assert(r.ingredients.length > 0);
    assert(r.steps.length > 0);
    assert(r.minutes <= 30);
    assert(r.ingredients.every((i) => i.quantity === null || i.quantity > 0));
  }
});
test("reject unknown recipes, weekend entries and invalid dates", () => {
  assert.throws(() =>
    validateState({ ...emptyState(), plan: { "2026-11-16": "unknown" } }),
  );
  assert.throws(() =>
    validateState({ ...emptyState(), plan: { "2026-11-21": "gnocchi" } }),
  );
  assert.throws(() =>
    validateState({ ...emptyState(), plan: { "2026-02-30": "gnocchi" } }),
  );
  assert.throws(() =>
    validateState({ ...emptyState(), plan: { "2026-11-16": "toString" } }),
  );
});
