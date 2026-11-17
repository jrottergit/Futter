import { recipeById, recipes } from "./recipes.js";
export function localDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function nextWorkdays(start = localDate()) {
  const date = new Date(`${start}T12:00:00Z`),
    result = [];
  while (result.length < 5) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
      result.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return result;
}
export const categories = [
  "Gemüse & Obst",
  "Kühlregal",
  "Vorrat",
  "Brot & Backwaren",
  "Tiefkühl",
  "Getränke",
  "Haushalt",
  "Sonstiges",
];
export const emptyState = () => ({
  version: 3,
  plan: {},
  checked: [],
  manualItems: [],
  ingredientOverrides: {},
});
export const units = [
  ...new Set([
    ...recipes.flatMap((r) => r.ingredients.map((i) => i.unit)),
    "kg",
    "ml",
    "l",
    "Packung",
    "Tüte",
    "Glas",
    "EL",
    "TL",
    "nach Bedarf",
  ]),
];
export function getRecipe(id, state) {
  const recipe = recipeById[id];
  return recipe
    ? {
        ...recipe,
        ingredients: state.ingredientOverrides?.[id] || recipe.ingredients,
      }
    : undefined;
}
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value + "T12:00:00Z")) &&
  new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
export function cleanState(state, today = localDate()) {
  const next = {
    ...state,
    plan: Object.fromEntries(
      Object.entries(state.plan).filter(([day]) => day >= today),
    ),
    manualItems: state.manualItems.filter(
      (item) => item.checkedOn === null || item.checkedOn >= today,
    ),
  };
  const dates = nextWorkdays(today);
  const valid = new Set(
    shopping(next, dates)
      .filter((item) => !item.manualId)
      .map((item) => checkKey(item, dates)),
  );
  next.checked = next.checked.filter((key) => valid.has(key));
  return next;
}
export const isChecked = (state, item, dates) =>
  item.manualId
    ? item.checkedOn !== null
    : state.checked.includes(checkKey(item, dates));
export function toggleItem(state, item, dates, checked, today = localDate()) {
  if (item.manualId)
    return {
      ...state,
      manualItems: state.manualItems.map((m) =>
        m.id === item.manualId
          ? { ...m, checkedOn: checked ? today : null }
          : m,
      ),
    };
  const key = checkKey(item, dates);
  return {
    ...state,
    checked: checked
      ? [...new Set([...state.checked, key])]
      : state.checked.filter((k) => k !== key),
  };
}
export const periodKey = (dates) => dates.join("|");
export function shopping(state, dates) {
  const items = new Map();
  for (const day of dates) {
    const recipe = getRecipe(state.plan[day], state);
    if (!recipe) continue;
    for (const i of recipe.ingredients) {
      const unit = i.unit === "kg" ? "g" : i.unit === "l" ? "ml" : i.unit;
      const quantity =
        i.quantity === null
          ? null
          : i.quantity * (i.unit === "kg" || i.unit === "l" ? 1000 : 1);
      const key = `${i.name.trim().toLocaleLowerCase("de-DE")}|${unit}`;
      const item = items.get(key);
      if (item) {
        if (quantity !== null) item.quantity = (item.quantity ?? 0) + quantity;
      } else items.set(key, { ...i, unit, quantity, key });
    }
  }
  return [
    ...items.values(),
    ...state.manualItems.map((item) => ({
      ...item,
      manualId: item.id,
      key: `manual:${item.id}`,
      quantity: null,
      unit: "",
    })),
  ].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "de") ||
      a.name.localeCompare(b.name, "de"),
  );
}
export const quantityLabel = (item) =>
  item.manualId
    ? ""
    : item.quantity === null
      ? "nach Bedarf"
      : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(item.quantity)} ${item.unit}`;
// Mengen und Zeitraum gehören in den Schlüssel: Mehrbedarf oder ein neuer Zeitraum wird nicht als erledigt behandelt.
export const checkKey = (item, dates) =>
  `${periodKey(dates)}:${item.key}:${item.quantity}`;
export function setDish(state, date, id, dates) {
  const next = {
    ...state,
    plan: { ...state.plan, [date]: id },
    checked: [...state.checked],
  };
  const valid = new Set(shopping(next, dates).map((i) => checkKey(i, dates)));
  next.checked = next.checked.filter((k) => valid.has(k));
  return next;
}
export function validateState(state) {
  if (
    !state ||
    ![1, 2, 3].includes(state.version) ||
    !state.plan ||
    typeof state.plan !== "object" ||
    Array.isArray(state.plan) ||
    !Array.isArray(state.checked) ||
    state.checked.length > 500
  )
    throw new Error("Ungültiger Plan");
  const entries = Object.entries(state.plan);
  if (entries.length > 2000) throw new Error("Plan ist zu groß");
  for (const [day, id] of entries) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      Number.isNaN(Date.parse(`${day}T12:00:00Z`)) ||
      new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day ||
      ![1, 2, 3, 4, 5].includes(new Date(`${day}T12:00:00Z`).getUTCDay()) ||
      !(
        id === null ||
        (typeof id === "string" && Object.hasOwn(recipeById, id))
      )
    )
      throw new Error("Ungültiger Planeintrag");
  }
  if (state.checked.some((k) => typeof k !== "string" || k.length > 400))
    throw new Error("Ungültiger Einkaufsstatus");
  let manualItems = [];
  if (state.version >= 2) {
    if (!Array.isArray(state.manualItems) || state.manualItems.length > 200)
      throw new Error("Ungültige manuelle Artikel");
    const ids = new Set();
    manualItems = state.manualItems.map((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,80}$/.test(item.id) ||
        ids.has(item.id) ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        item.name.length > 160 ||
        !categories.includes(item.category) ||
        !(item.checkedOn === null || validDate(item.checkedOn))
      )
        throw new Error("Ungültiger manueller Artikel");
      ids.add(item.id);
      return {
        id: item.id,
        name: item.name.trim(),
        category: item.category,
        checkedOn: item.checkedOn,
      };
    });
  }
  let ingredientOverrides = {};
  if (state.version === 3) {
    const overrides = state.ingredientOverrides;
    if (
      !overrides ||
      typeof overrides !== "object" ||
      Array.isArray(overrides) ||
      Object.keys(overrides).length > recipes.length
    )
      throw new Error("Ungültige Rezeptzutaten");
    ingredientOverrides = Object.fromEntries(
      Object.entries(overrides).map(([id, ingredients]) => {
        if (
          !Object.hasOwn(recipeById, id) ||
          !Array.isArray(ingredients) ||
          ingredients.length < 1 ||
          ingredients.length > 40
        )
          throw new Error("Pro Rezept sind 1 bis 40 Zutaten erforderlich.");
        return [
          id,
          ingredients.map((i) => {
            if (
              !i ||
              typeof i.name !== "string" ||
              !i.name.trim() ||
              i.name.length > 100 ||
              !units.includes(i.unit) ||
              !categories.includes(i.category) ||
              !(i.unit === "nach Bedarf"
                ? i.quantity === null
                : typeof i.quantity === "number" &&
                  Number.isFinite(i.quantity) &&
                  i.quantity > 0 &&
                  i.quantity <= 100000)
            )
              throw new Error(
                "Bitte Zutatenname, positive Menge, Einheit und Kategorie angeben.",
              );
            return {
              name: i.name.trim(),
              quantity: i.quantity,
              unit: i.unit,
              category: i.category,
            };
          }),
        ];
      }),
    );
  }
  return {
    version: 3,
    plan: Object.fromEntries(entries),
    checked: [...state.checked],
    manualItems,
    ingredientOverrides,
  };
}
