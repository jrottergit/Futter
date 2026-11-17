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
test("all sample recipes have ingredients and take no more than 30 minutes", () => {
  for (const r of recipes) {
    assert(r.ingredients.length > 0);
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

test("daily cleanup removes past dinners and bought manual items, but keeps open items", async () => {
  const { cleanState, isChecked, toggleItem } = await import("../src/core.js");
  const s = {
    ...emptyState(),
    plan: { "2026-11-20": "gnocchi", "2026-11-23": "couscous" },
    manualItems: [
      { id: "open", name: "Kaffee", category: "Vorrat", checkedOn: null },
      {
        id: "done",
        name: "Spülmittel",
        category: "Haushalt",
        checkedOn: "2026-11-20",
      },
    ],
  };
  const friday = nextWorkdays("2026-11-20");
  s.checked = shopping(s, friday)
    .filter((i) => !i.manualId)
    .map((i) => checkKey(i, friday));
  assert.equal(cleanState(s, "2026-11-20").manualItems.length, 2);
  const next = cleanState(s, "2026-11-21");
  assert.deepEqual(next.plan, { "2026-11-23": "couscous" });
  assert.deepEqual(
    next.manualItems.map((i) => i.id),
    ["open"],
  );
  assert.equal(next.checked.length, 0);
  assert.equal(
    shopping(next, nextWorkdays("2026-11-21")).some(
      (i) => i.name === "Gnocchi",
    ),
    false,
  );
  const manual = shopping(next, nextWorkdays("2026-11-21")).find(
    (i) => i.manualId,
  );
  const done = toggleItem(
    next,
    manual,
    nextWorkdays("2026-11-21"),
    true,
    "2026-11-21",
  );
  assert.equal(done.manualItems[0].checkedOn, "2026-11-21");
  assert.equal(
    isChecked(done, { ...manual, checkedOn: "2026-11-21" }, friday),
    true,
  );
  assert.equal(cleanState(done, "2026-11-22").manualItems.length, 0);
});
test("legacy migration preserves plan and checks; invalid manual data is rejected", () => {
  const old = {
    version: 1,
    plan: { "2026-11-20": "gnocchi" },
    checked: ["existing"],
  };
  assert.deepEqual(validateState(old), {
    ...old,
    version: 3,
    manualItems: [],
    ingredientOverrides: {},
  });
  for (const manualItems of [
    [{ id: "a", name: "", category: "Vorrat", checkedOn: null }],
    [{ id: "a", name: "Kaffee", category: "Injected", checkedOn: null }],
    [{ id: "a", name: "Kaffee", category: "Vorrat", checkedOn: "2026-02-30" }],
  ])
    assert.throws(() => validateState({ ...emptyState(), manualItems }));
});
test("Berlin calendar day handles daylight-saving changes and midnight", () => {
  assert.equal(localDate(new Date("2026-10-24T22:30:00Z")), "2026-10-25");
  assert.equal(localDate(new Date("2026-10-25T23:30:00Z")), "2026-10-26");
});

test("ingredient overrides affect shopping; v2 migration keeps manual items", async () => {
  const { getRecipe } = await import("../src/core.js");
  const dates = nextWorkdays("2026-11-20");
  const item = {
    id: "coffee",
    name: "Kaffee",
    category: "Vorrat",
    checkedOn: null,
  };
  const legacy = {
    version: 2,
    plan: { [dates[0]]: "asia-lentils" },
    checked: [],
    manualItems: [item],
  };
  const migrated = validateState(legacy);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.manualItems, [item]);
  assert.deepEqual(migrated.ingredientOverrides, {});
  const ingredients = [
    { name: "Rote Linsen", quantity: 2, unit: "Packung", category: "Vorrat" },
  ];
  const state = validateState({
    ...migrated,
    ingredientOverrides: { "asia-lentils": ingredients },
  });
  assert.deepEqual(getRecipe("asia-lentils", state).ingredients, ingredients);
  assert.equal(
    shopping(state, dates).find((i) => i.name === "Rote Linsen").quantity,
    2,
  );
  for (const change of [
    { quantity: -1 },
    { quantity: Infinity },
    { name: "" },
    { unit: "<script>" },
    { category: "Unknown" },
  ])
    assert.throws(() =>
      validateState({
        ...state,
        ingredientOverrides: {
          "asia-lentils": [{ ...ingredients[0], ...change }],
        },
      }),
    );
  assert.throws(() =>
    validateState({
      ...state,
      ingredientOverrides: { __invalid__: ingredients },
    }),
  );
});
