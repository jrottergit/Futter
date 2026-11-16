import { recipeById } from "./recipes.js";
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
export const emptyState = () => ({ version: 1, plan: {}, checked: [] });
export const periodKey = (dates) => dates.join("|");
export function shopping(state, dates) {
  const items = new Map();
  for (const day of dates) {
    const recipe = recipeById[state.plan[day]];
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
  return [...items.values()].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "de") ||
      a.name.localeCompare(b.name, "de"),
  );
}
export const quantityLabel = (item) =>
  item.quantity === null
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
    state.version !== 1 ||
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
  return {
    version: 1,
    plan: Object.fromEntries(entries),
    checked: [...state.checked],
  };
}
