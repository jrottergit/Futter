import "./style.css";
import { recipes, recipeById } from "./recipes.js";
import {
  localDate,
  nextWorkdays,
  emptyState,
  shopping,
  quantityLabel,
  checkKey,
  setDish,
  validateState,
  cleanState,
  categories,
  isChecked,
  toggleItem,
  getRecipe,
  units,
} from "./core.js";
const root = document.querySelector("#app");
const STORAGE = "futter-preview-v1";
let state = emptyState(),
  revision = 0,
  dates = nextWorkdays(),
  tab = "plan",
  mode = "loading",
  busy = false,
  message = "",
  search = "",
  filter = "Alle",
  selection = null;
let displayedToday = localDate();
let editingRecipeId = null,
  ingredientDraft = [];
const snacks = ["Kekse", "Schokobons", "Chips", "Nüsse", "Schoki", "Salat"];
let manualName = "",
  manualCategory = "Sonstiges";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateLabel = (date, options) =>
  new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
const range = () =>
  `${dateLabel(dates[0], { day: "numeric", month: "short" })} – ${dateLabel(dates[4], { day: "numeric", month: "short" })}`;
const icon = (type) => ({ plan: "▦", recipes: "♧", shopping: "✓" })[type];
const dishArt = (r) =>
  `<div class="dish-art ${r.art}" aria-hidden="true"><div class="plate"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`;
async function api(path, options = {}) {
  const response = await fetch(new URL(`api/${path}`, document.baseURI), {
    ...options,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  return { status: response.status, ok: response.ok, body };
}
function render() {
  if (mode === "loading") {
    root.innerHTML =
      '<main class="gate"><div class="wordmark">futter<span>•</span></div><p>Lade …</p></main>';
    return;
  }
  if (mode === "storage-error") {
    root.innerHTML =
      '<main class="gate"><h1>Plan nicht lesbar</h1><p>Der lokale Speicher enthält ungültige Daten. Sie wurden nicht überschrieben. Bitte sichere den Eintrag futter-preview-v1 aus dem Browserspeicher, bevor er repariert wird.</p></main>';
    return;
  }
  if (mode === "login") {
    root.innerHTML = `<main class="gate"><div class="wordmark">futter<span>•</span></div><h1>Anmelden</h1><form id="login"><label>Haushaltspasswort<input name="password" type="password" autocomplete="current-password" required maxlength="512"></label><button class="primary" ${busy ? "disabled" : ""}>${busy ? "Anmelden …" : "Anmelden →"}</button></form><p role="alert">${esc(message)}</p></main>`;
    return;
  }
  const items = shopping(state, dates),
    count = dates.filter((d) => state.plan[d]).length;
  root.innerHTML = `<div class="shell"><header><a href="#" class="wordmark" aria-label="Futter Startseite">futter<span>•</span></a>${mode === "online" ? '<button data-action="logout" class="text-button">Abmelden</button>' : '<span class="preview-badge">Lokale Vorschau</span>'}</header>
 <main>${mode === "preview" ? '<div class="notice">Lokale Vorschau · Keine Synchronisierung.</div>' : ""}${message ? `<div class="notice" role="alert">${esc(message)} <button data-action="dismiss" class="text-button">Schließen</button></div>` : ""}
 ${tab === "plan" ? renderPlan(count) : tab === "recipes" ? renderRecipes() : renderShopping(items)}
 <div class="save-note" role="status">${busy ? "Speichere …" : mode === "online" ? "Gespeichert" : "Auf diesem Gerät gespeichert"}</div></main>
 <nav aria-label="Hauptnavigation">${[
   ["plan", "Plan"],
   ["recipes", "Rezepte"],
   ["shopping", "Einkauf"],
 ]
   .map(
     ([id, label]) =>
       `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon(id)}</span>${label}${id === "shopping" && items.length ? `<small>${items.filter((i) => !isChecked(state, i, dates)).length}</small>` : ""}</button>`,
   )
   .join("")}</nav></div><dialog id="recipe-dialog"></dialog>`;
}
function renderPlan(count) {
  return `<section class="intro"><p class="eyebrow">${esc(range())} · NUR WERKTAGS</p><h1>Essensplan</h1><p>Abendessen für 2 Personen</p></section><div class="section-heading"><h2>Nächste fünf Werktage</h2><span>${count} von 5 geplant</span></div><div class="days">${dates
    .map((d) => {
      const r = getRecipe(state.plan[d], state);
      return `<article class="day ${r ? "filled" : ""}"><div class="day-date"><strong>${dateLabel(d, { weekday: "short" }).replace(".", "")}</strong><span>${dateLabel(d, { day: "2-digit", month: "2-digit" })}</span>${d === localDate() ? "<small>HEUTE</small>" : ""}</div><div class="day-content">${r ? `<button class="dish-name" data-detail="${r.id}">${esc(r.name)}</button><p>${r.minutes} Min. <span>·</span> ${r.tag} <span>·</span> Für 2</p><div class="day-actions"><button class="text-button" data-choose="${d}">Wechseln</button><button class="text-button muted" data-remove="${d}" aria-label="Gericht am ${d} entfernen">Entfernen</button></div>` : `<button class="add-dish" data-choose="${d}">＋ Gericht wählen</button>`}</div></article>`;
    })
    .join("")}</div>`;
}
function renderRecipes() {
  const list = recipes.filter(
    (r) =>
      (filter === "Alle" ||
        (filter === "Veggie" ? r.tag !== "Mit Fleisch" : r.tag === "Vegan")) &&
      r.name.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de")),
  );
  return `<section class="intro"><h1>Rezepte</h1><p>Für 2 Personen</p></section><div class="recipe-tools"><label class="search">⌕ <input id="search" type="search" placeholder="Rezepte suchen" aria-label="Rezepte suchen" value="${esc(search)}"></label><div class="filters">${["Alle", "Veggie", "Vegan"].map((f) => `<button data-filter="${f}" aria-pressed="${f === filter}">${f}</button>`).join("")}</div></div><div class="recipes">${list.map((r) => `<button class="recipe-card" data-detail="${r.id}">${dishArt(r)}<div class="recipe-copy"><p class="eyebrow">${r.minutes} MIN. · ${r.tag.toUpperCase()}</p><h2>${r.name}</h2><span class="recipe-link">Rezept ansehen ↗</span></div></button>`).join("") || "<p>Kein Gericht gefunden. Probiert einen anderen Suchbegriff.</p>"}</div>`;
}
function renderShopping(items) {
  const groups = [...new Set(items.map((i) => i.category))],
    done = items.filter((i) => isChecked(state, i, dates)).length;
  return `<section class="intro"><p class="eyebrow">${esc(range())} · FÜR ZWEI</p><h1>Einkaufsliste</h1><button type="button" class="snack-button" data-action="snacks"><span aria-hidden="true">🚨</span> SNAAACKS!</button><p>${items.length ? `${items.length - done} offen · ${done} erledigt` : "Noch keine Artikel."}</p></section><form id="manual-form" class="manual-form"><div class="manual-field"><label for="manual-name">Artikel</label><input id="manual-name" name="name" maxlength="160" required placeholder="z. B. Kaffee" value="${esc(manualName)}" ${busy ? "disabled" : ""}></div><div class="manual-field"><label for="manual-category">Kategorie</label><select id="manual-category" name="category" ${busy ? "disabled" : ""}>${categories.map((c) => `<option ${c === manualCategory ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div><button class="primary" ${busy ? "disabled" : ""}>Hinzufügen</button></form>${
    items.length
      ? `<div class="shopping-groups">${groups
          .map(
            (g) =>
              `<section><h2>${g}</h2>${items
                .filter((i) => i.category === g)
                .map((i) => {
                  const key = checkKey(i, dates),
                    checked = isChecked(state, i, dates);
                  return `<div class="shopping-entry"><label class="shopping-row ${checked ? "done" : ""}"><input type="checkbox" data-item="${esc(i.key)}" ${checked ? "checked" : ""} ${busy ? "disabled" : ""}><span>${esc(i.name)}</span><strong>${quantityLabel(i)}</strong></label>${i.manualId ? `<div class="manual-actions"><button class="text-button" data-manual-delete="${i.manualId}" aria-label="${esc(i.name)} löschen" ${busy ? "disabled" : ""}>Löschen</button></div>` : ""}</div>`;
                })
                .join("")}</section>`,
          )
          .join("")}</div>`
      : '<div class="empty-shopping"><h2>Keine Artikel</h2><p>Wählt ein Gericht im Plan aus.</p><button class="primary" data-tab="plan">Gerichte planen →</button></div>'
  }`;
}
function openChooser(day) {
  selection = day;
  openDialog(
    `<p class="eyebrow">${dateLabel(day, { weekday: "long", day: "numeric", month: "short" })} · ABENDESSEN FÜR 2</p><h2>Gericht auswählen</h2><div class="chooser">${recipes.map((r) => `<button data-pick="${r.id}"><span><strong>${r.name}</strong><small>${r.minutes} Min. · ${r.tag}</small></span><span aria-hidden="true">＋</span></button>`).join("")}</div>`,
  );
}
function openDialog(html) {
  const dialog = document.querySelector("dialog");
  dialog.innerHTML = `<button class="close" data-action="close" aria-label="Dialog schließen">×</button>${html}`;
  dialog.setAttribute("aria-label", "Rezeptauswahl und Rezeptdetails");
  dialog.showModal();
}
function detail(id) {
  const r = getRecipe(id, state);
  selection = null;
  openDialog(
    `<p class="eyebrow">${r.minutes} MIN. · ${r.tag.toUpperCase()} · FÜR 2</p><h2>${r.name}</h2><h3>Zutaten</h3><ul class="ingredients">${r.ingredients.map((i) => `<li><span>${esc(i.name)}</span><strong>${quantityLabel(i)}</strong></li>`).join("")}</ul><button class="secondary-button" data-edit-recipe="${r.id}">Zutaten bearbeiten</button><label class="date-select">Tag<select id="target-day">${dates.map((d) => `<option value="${d}">${dateLabel(d, { weekday: "long", day: "numeric", month: "short" })}${state.plan[d] ? " · belegt" : ""}</option>`).join("")}</select></label><button class="primary full" data-pick="${r.id}">Für diesen Tag einplanen →</button>`,
  );
}
function editIngredients(id, preserve = false) {
  editingRecipeId = id;
  if (!preserve)
    ingredientDraft = getRecipe(id, state).ingredients.map((i) => ({
      ...i,
      quantity: i.quantity === null ? "" : String(i.quantity),
    }));
  openDialog(
    `<h2>Zutaten bearbeiten</h2><p>${esc(recipeById[id].name)} · Für 2 Personen</p><form id="ingredient-form"><div class="ingredient-editor">${ingredientDraft.map((i, index) => `<fieldset><legend>Zutat ${index + 1}</legend><label for="ingredient-name-${index}">Name</label><input id="ingredient-name-${index}" data-ingredient="${index}" data-field="name" maxlength="100" value="${esc(i.name)}" required><div class="ingredient-amount"><label>Menge<input aria-label="Menge ${index + 1}" data-ingredient="${index}" data-field="quantity" inputmode="decimal" value="${esc(i.quantity)}" ${i.unit === "nach Bedarf" ? "disabled" : "required"}></label><label for="ingredient-unit-${index}">Einheit</label><select id="ingredient-unit-${index}" data-ingredient="${index}" data-field="unit">${units.map((u) => `<option ${u === i.unit ? "selected" : ""}>${esc(u)}</option>`).join("")}</select></div><label for="ingredient-category-${index}">Kategorie</label><select id="ingredient-category-${index}" data-ingredient="${index}" data-field="category">${categories.map((c) => `<option ${c === i.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select><button type="button" class="text-button" data-remove-ingredient="${index}" ${ingredientDraft.length === 1 ? "disabled" : ""}>Zutat entfernen</button></fieldset>`).join("")}</div><button type="button" class="secondary-button" data-action="add-ingredient" ${ingredientDraft.length >= 40 ? "disabled" : ""}>Zutat hinzufügen</button><p id="ingredient-error" role="alert">${esc(message)}</p><button class="primary full">Zutaten speichern</button></form>`,
  );
}
function openSnacks() {
  openDialog(
    `<h2>🚨 SNAAACKS!</h2><form id="snack-form"><div class="snack-options">${snacks.map((name, index) => `<label><input type="checkbox" name="snack" value="${index}"><span>${name}</span></label>`).join("")}</div><p id="snack-error" role="alert"></p><button class="primary full">Zur Einkaufsliste hinzufügen</button></form>`,
  );
}
function captureIngredient(target) {
  if (target.dataset.ingredient === undefined) return;
  const row = ingredientDraft[Number(target.dataset.ingredient)];
  if (!row) return;
  row[target.dataset.field] = target.value;
  if (target.dataset.field === "unit") {
    if (target.value === "nach Bedarf") row.quantity = "";
    editIngredients(editingRecipeId, true);
  }
}
async function change(next) {
  if (busy) return;
  next = cleanState(next);
  busy = true;
  message = "";
  if (mode === "preview") {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      state = next;
    } catch {
      message = "Nicht gespeichert: Der lokale Speicher ist nicht verfügbar.";
    }
    busy = false;
    render();
    return;
  }
  render();
  try {
    const result = await api("state", {
      method: "PUT",
      body: JSON.stringify({ state: next, revision }),
    });
    if (result.status === 401) {
      mode = "login";
      message = "Bitte erneut anmelden.";
    } else if (result.status === 409) {
      state = cleanState(validateState(result.body.state));
      revision = result.body.revision;
      message =
        "Euer Plan wurde gerade auf dem anderen Gerät geändert. Der aktuelle Stand ist geladen; bitte wiederhole deine Auswahl.";
    } else if (!result.ok) throw new Error();
    else {
      state = cleanState(validateState(result.body.state));
      revision = result.body.revision;
    }
  } catch {
    message =
      "Änderung nicht gespeichert. Bitte Verbindung prüfen und noch einmal versuchen.";
  } finally {
    busy = false;
    render();
  }
}
root.addEventListener("click", async (e) => {
  const button = e.target.closest("button");
  if (!button || busy) return;
  if (button.dataset.editRecipe) editIngredients(button.dataset.editRecipe);
  if (button.dataset.removeIngredient !== undefined) {
    ingredientDraft.splice(Number(button.dataset.removeIngredient), 1);
    editIngredients(editingRecipeId, true);
  }
  if (button.dataset.action === "add-ingredient") {
    ingredientDraft.push({
      name: "",
      quantity: "",
      unit: "g",
      category: "Vorrat",
    });
    editIngredients(editingRecipeId, true);
  }
  if (button.dataset.action === "snacks") openSnacks();
  if (button.dataset.tab) {
    tab = button.dataset.tab;
    render();
    window.scrollTo({ top: 0 });
  }
  if (button.dataset.choose) openChooser(button.dataset.choose);
  if (button.dataset.detail) detail(button.dataset.detail);
  if (button.dataset.pick) {
    const date = selection || document.querySelector("#target-day")?.value;
    if (date) {
      document.querySelector("dialog").close();
      await change(setDish(state, date, button.dataset.pick, dates));
    }
  }
  if (button.dataset.manualDelete)
    await change({
      ...state,
      manualItems: state.manualItems.filter(
        (i) => i.id !== button.dataset.manualDelete,
      ),
    });
  if (button.dataset.remove)
    await change(setDish(state, button.dataset.remove, null, dates));
  if (button.dataset.filter) {
    filter = button.dataset.filter;
    render();
  }
  if (button.dataset.action === "close")
    document.querySelector("dialog").close();
  if (button.dataset.action === "dismiss") {
    message = "";
    render();
  }
  if (button.dataset.action === "logout") {
    try {
      const r = await api("logout", { method: "POST", body: "{}" });
      if (!r.ok) throw new Error();
      mode = "login";
      state = emptyState();
      message = "";
      render();
    } catch {
      message = "Abmelden fehlgeschlagen. Bitte erneut versuchen.";
      render();
    }
  }
});
root.addEventListener("change", (e) => {
  if (e.target.dataset.ingredient !== undefined) {
    captureIngredient(e.target);
    return;
  }
  if (e.target.id === "manual-category") {
    manualCategory = e.target.value;
    return;
  }
  if (e.target.dataset.item && !busy) {
    const item = shopping(state, dates).find(
      (i) => i.key === e.target.dataset.item,
    );
    if (item) change(toggleItem(state, item, dates, e.target.checked));
  }
});
root.addEventListener("input", (e) => {
  if (e.target.dataset.ingredient !== undefined) captureIngredient(e.target);
  if (e.target.id === "manual-name") manualName = e.target.value;
  if (e.target.id === "search") {
    search = e.target.value;
    const start = e.target.selectionStart;
    render();
    const input = document.querySelector("#search");
    input.focus();
    input.setSelectionRange(start, start);
  }
});
root.addEventListener("submit", async (e) => {
  if (e.target.id === "ingredient-form") {
    e.preventDefault();
    if (busy) return;
    const id = editingRecipeId;
    const ingredients = ingredientDraft.map((i) => ({
      ...i,
      quantity:
        i.unit === "nach Bedarf"
          ? null
          : Number(String(i.quantity).replace(",", ".")),
    }));
    let next;
    try {
      next = validateState({
        ...state,
        ingredientOverrides: {
          ...state.ingredientOverrides,
          [id]: ingredients,
        },
      });
    } catch (error) {
      document.querySelector("#ingredient-error").textContent = error.message;
      return;
    }
    document.querySelector("dialog").close();
    await change(next);
    if (message) editIngredients(id, true);
    else detail(id);
    return;
  }
  if (e.target.id === "snack-form") {
    e.preventDefault();
    if (busy) return;
    const names = new FormData(e.target)
      .getAll("snack")
      .map((v) => snacks[Number(v)])
      .filter(Boolean);
    const fresh = names.filter(
      (name) =>
        !state.manualItems.some(
          (i) =>
            i.name.toLocaleLowerCase("de") === name.toLocaleLowerCase("de") &&
            i.checkedOn === null,
        ),
    );
    if (!names.length) {
      document.querySelector("#snack-error").textContent =
        "Bitte Snacks auswählen.";
      return;
    }
    if (state.manualItems.length + fresh.length > 200) {
      document.querySelector("#snack-error").textContent =
        "Maximal 200 manuelle Artikel.";
      return;
    }
    document.querySelector("dialog").close();
    if (fresh.length)
      await change({
        ...state,
        manualItems: [
          ...state.manualItems,
          ...fresh.map((name) => ({
            id: crypto.randomUUID(),
            name,
            category: name === "Salat" ? "Gemüse & Obst" : "Vorrat",
            checkedOn: null,
          })),
        ],
      });
    return;
  }

  if (e.target.id === "manual-form") {
    e.preventDefault();
    if (busy) return;
    const name = manualName.trim();
    if (!name) return;
    if (state.manualItems.length >= 200) {
      message = "Maximal 200 manuelle Artikel.";
      render();
      return;
    }
    const id = crypto.randomUUID();
    await change({
      ...state,
      manualItems: [
        ...state.manualItems,
        { id, name, category: manualCategory, checkedOn: null },
      ],
    });
    if (state.manualItems.some((i) => i.id === id)) {
      manualName = "";
      render();
      document.querySelector("#manual-name")?.focus();
    }
    return;
  }

  if (e.target.id !== "login") return;
  e.preventDefault();
  if (busy) return;
  const password = new FormData(e.target).get("password");
  busy = true;
  message = "";
  render();
  try {
    const r = await api("login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!r.ok) {
      message = r.body.error || "Anmelden fehlgeschlagen.";
    } else await loadShared();
  } catch {
    message = "Server nicht erreichbar. Bitte später erneut versuchen.";
  } finally {
    busy = false;
    render();
  }
});
async function loadShared() {
  const result = await api("state");
  if (!result.ok) throw new Error();
  state = cleanState(validateState(result.body.state));
  revision = result.body.revision;
  mode = "online";
}
async function boot() {
  render();
  try {
    const r = await api("session");
    if (!r.ok) throw new Error();
    if (r.body.authenticated) await loadShared();
    else mode = "login";
  } catch {
    mode = "preview";
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) state = cleanState(validateState(JSON.parse(raw)));
    } catch {
      message =
        "Der lokale Plan konnte nicht gelesen werden. Er wurde nicht überschrieben.";
      mode = "storage-error";
    }
  }
  render();
}
// Keine Hintergrund-Neudarstellung während einer geöffneten Rezeptauswahl.
async function refreshDayAndState() {
  const next = nextWorkdays();
  if (!busy && displayedToday !== localDate()) {
    displayedToday = localDate();
    dates = next;
    state = cleanState(state, displayedToday);
    if (mode === "preview") {
      try {
        localStorage.setItem(STORAGE, JSON.stringify(state));
      } catch {
        message = "Tageswechsel konnte nicht lokal gespeichert werden.";
      }
    }
    if (mode === "preview" || mode === "online") render();
  }
  if (mode !== "online" || busy || document.querySelector("dialog")?.open)
    return;
  const requestedRevision = revision;
  try {
    const r = await api("state");
    if (busy || revision !== requestedRevision) return;
    if (r.status === 401) {
      mode = "login";
      message = "Bitte erneut anmelden.";
      render();
    } else if (r.ok && r.body.revision !== revision) {
      state = cleanState(validateState(r.body.state));
      revision = r.body.revision;
      render();
    }
  } catch {
    /* Offline-Änderungen werden erst nach bestätigtem Speichern übernommen. */
  }
}
setInterval(refreshDayAndState, 10000);
window.addEventListener("focus", refreshDayAndState);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refreshDayAndState();
});
boot();
