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
  `<div class="dish-art ${r.art}" aria-hidden="true"><div class="plate"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span>${r.tag === "Mit Fleisch" ? "Aus der Pfanne" : "Pflanzen auf den Teller"}</span></div>`;
async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, {
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
      '<main class="gate"><div class="wordmark">futter<span>•</span></div><p>Dein Abendessen nimmt Form an …</p></main>';
    return;
  }
  if (mode === "storage-error") {
    root.innerHTML =
      '<main class="gate"><h1>Plan nicht lesbar</h1><p>Der lokale Speicher enthält ungültige Daten. Sie wurden nicht überschrieben. Bitte sichere den Eintrag futter-preview-v1 aus dem Browserspeicher, bevor er repariert wird.</p></main>';
    return;
  }
  if (mode === "login") {
    root.innerHTML = `<main class="gate"><div class="wordmark">futter<span>•</span></div><p class="eyebrow">EUER PLATZ AM TISCH</p><h1>Gutes Essen.<br>Gemeinsam geplant.</h1><p>Melde dich für euren gemeinsamen Plan und eure Einkaufsliste an.</p><form id="login"><label>Haushaltspasswort<input name="password" type="password" autocomplete="current-password" required maxlength="512"></label><button class="primary" ${busy ? "disabled" : ""}>${busy ? "Anmelden …" : "Anmelden →"}</button></form><p role="alert">${esc(message)}</p></main>`;
    return;
  }
  const items = shopping(state, dates),
    count = dates.filter((d) => state.plan[d]).length;
  root.innerHTML = `<div class="shell"><header><a href="#" class="wordmark" aria-label="Futter Startseite">futter<span>•</span></a><span class="household">Zwei am Tisch <span aria-hidden="true">↗</span></span>${mode === "online" ? '<button data-action="logout" class="text-button">Abmelden</button>' : '<span class="preview-badge">Lokale Vorschau</span>'}</header>
 <main>${mode === "preview" ? '<div class="notice">Vorschau auf diesem Gerät · Noch nicht mit deiner Partnerin geteilt.</div>' : ""}${message ? `<div class="notice" role="alert">${esc(message)} <button data-action="dismiss" class="text-button">Schließen</button></div>` : ""}
 ${tab === "plan" ? renderPlan(count) : tab === "recipes" ? renderRecipes() : renderShopping(items)}
 <div class="save-note" role="status">${busy ? "Speichere …" : mode === "online" ? "Gemeinsamer Haushalt · Stand wird regelmäßig aktualisiert" : "Auf diesem Gerät gespeichert"}</div></main>
 <nav aria-label="Hauptnavigation">${[
   ["plan", "Mein Plan"],
   ["recipes", "Rezepte"],
   ["shopping", "Einkauf"],
 ]
   .map(
     ([id, label]) =>
       `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""}><span aria-hidden="true">${icon(id)}</span>${label}${id === "shopping" && items.length ? `<small>${items.filter((i) => !state.checked.includes(checkKey(i, dates))).length}</small>` : ""}</button>`,
   )
   .join(
     "",
   )}</nav><footer>Weniger überlegen. Besser zusammen essen.</footer></div><dialog id="recipe-dialog"></dialog>`;
}
function renderPlan(count) {
  return `<section class="intro"><p class="eyebrow">${esc(range())} · NUR WERKTAGS</p><h1>Und was essen<br>wir <em>heute?</em></h1><p>Fünf Abende. Zwei Personen. Ein guter Plan.</p></section><div class="section-heading"><h2>Eure nächsten Abende</h2><span>${count} von 5 geplant</span></div><div class="days">${dates
    .map((d) => {
      const r = recipeById[state.plan[d]];
      return `<article class="day ${r ? "filled" : ""}"><div class="day-date"><strong>${dateLabel(d, { weekday: "short" }).replace(".", "")}</strong><span>${dateLabel(d, { day: "2-digit", month: "2-digit" })}</span>${d === localDate() ? "<small>HEUTE</small>" : ""}</div><div class="day-content">${r ? `<button class="dish-name" data-detail="${r.id}">${esc(r.name)}</button><p>${r.minutes} Min. <span>·</span> ${r.tag} <span>·</span> Für 2</p><div class="day-actions"><button class="text-button" data-choose="${d}">Wechseln</button><button class="text-button muted" data-remove="${d}" aria-label="Gericht am ${d} entfernen">Entfernen</button></div>` : `<span class="empty-label">Noch alle Möglichkeiten offen.</span><button class="add-dish" data-choose="${d}">＋ Gericht wählen</button>`}</div>${r ? `<div class="mini-art ${r.art}" aria-hidden="true">✳</div>` : ""}</article>`;
    })
    .join(
      "",
    )}</div><aside class="shopping-teaser"><div><p class="eyebrow">ALLES AUF EINER LISTE</p><h2>Der Einkauf? Schon mitgedacht.</h2><p>Deine Zutatenliste wächst mit jedem Gericht.</p></div><button class="primary" data-tab="shopping">Zur Einkaufsliste →</button></aside>`;
}
function renderRecipes() {
  const list = recipes.filter(
    (r) =>
      (filter === "Alle" ||
        (filter === "Veggie" ? r.tag !== "Mit Fleisch" : r.tag === "Vegan")) &&
      r.name.toLocaleLowerCase("de").includes(search.toLocaleLowerCase("de")),
  );
  return `<section class="intro"><p class="eyebrow">SCHNELL GEMACHT · IMMER FÜR ZWEI</p><h1>Ein bisschen<br><em>Inspiration.</em></h1><p>Unkomplizierte Lieblingsgerichte für euren Feierabend.</p></section><div class="recipe-tools"><label class="search">⌕ <input id="search" type="search" placeholder="Worauf habt ihr Lust?" aria-label="Rezepte suchen" value="${esc(search)}"></label><div class="filters">${["Alle", "Veggie", "Vegan"].map((f) => `<button data-filter="${f}" aria-pressed="${f === filter}">${f}</button>`).join("")}</div></div><div class="recipes">${list.map((r) => `<button class="recipe-card" data-detail="${r.id}">${dishArt(r)}<div class="recipe-copy"><p class="eyebrow">${r.minutes} MIN. · ${r.tag.toUpperCase()}</p><h2>${r.name}</h2><p>${r.description}</p><span class="recipe-link">Rezept ansehen ↗</span></div></button>`).join("") || "<p>Kein Gericht gefunden. Probiert einen anderen Suchbegriff.</p>"}</div>`;
}
function renderShopping(items) {
  const groups = [...new Set(items.map((i) => i.category))],
    done = items.filter((i) =>
      state.checked.includes(checkKey(i, dates)),
    ).length;
  return `<section class="intro"><p class="eyebrow">${esc(range())} · FÜR ZWEI</p><h1>Einmal einkaufen.<br><em>Alles da.</em></h1><p>${items.length ? `${items.length - done} offen · ${done} schon im Korb` : "Wählt eure Gerichte. Die Zutaten kommen von allein."}</p></section>${
    items.length
      ? `<div class="shopping-groups">${groups
          .map(
            (g) =>
              `<section><h2>${g}</h2>${items
                .filter((i) => i.category === g)
                .map((i) => {
                  const key = checkKey(i, dates),
                    checked = state.checked.includes(key);
                  return `<label class="shopping-row ${checked ? "done" : ""}"><input type="checkbox" data-check="${esc(key)}" ${checked ? "checked" : ""} ${busy ? "disabled" : ""}><span>${esc(i.name)}</span><strong>${quantityLabel(i)}</strong></label>`;
                })
                .join("")}</section>`,
          )
          .join(
            "",
          )}</div><p class="hint">Salz, Öl & Co. stehen mit auf der Liste. Was ihr schon da habt, könnt ihr direkt abhaken.</p>`
      : '<div class="empty-shopping"><span aria-hidden="true">♧</span><h2>Hier ist noch Platz für Gutes.</h2><p>Sobald ihr ein Gericht einplant, findet ihr hier die passenden Zutaten.</p><button class="primary" data-tab="plan">Gerichte planen →</button></div>'
  }`;
}
function openChooser(day) {
  selection = day;
  openDialog(
    `<p class="eyebrow">${dateLabel(day, { weekday: "long", day: "numeric", month: "short" })} · ABENDESSEN FÜR 2</p><h2>Was darf’s sein?</h2><p>Alle Gerichte sind in höchstens 30 Minuten fertig.</p><div class="chooser">${recipes.map((r) => `<button data-pick="${r.id}"><span><strong>${r.name}</strong><small>${r.minutes} Min. · ${r.tag}</small></span><span aria-hidden="true">＋</span></button>`).join("")}</div>`,
  );
}
function openDialog(html) {
  const dialog = document.querySelector("dialog");
  dialog.innerHTML = `<button class="close" data-action="close" aria-label="Dialog schließen">×</button>${html}`;
  dialog.setAttribute("aria-label", "Rezeptauswahl und Rezeptdetails");
  dialog.showModal();
}
function detail(id) {
  const r = recipeById[id];
  selection = null;
  openDialog(
    `<p class="eyebrow">${r.minutes} MIN. · ${r.tag.toUpperCase()} · FÜR 2</p><h2>${r.name}</h2><p>${r.description}</p><h3>Das kommt rein</h3><ul class="ingredients">${r.ingredients.map((i) => `<li><span>${i.name}</span><strong>${quantityLabel(i)}</strong></li>`).join("")}</ul><h3>So geht’s</h3><ol class="steps">${r.steps.map((s) => `<li>${s}</li>`).join("")}</ol><label class="date-select">Für welchen Abend?<select id="target-day">${dates.map((d) => `<option value="${d}">${dateLabel(d, { weekday: "long", day: "numeric", month: "short" })}${state.plan[d] ? " · belegt" : ""}</option>`).join("")}</select></label><button class="primary full" data-pick="${r.id}">Für diesen Tag einplanen →</button>`,
  );
}
async function change(next) {
  if (busy) return;
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
      state = validateState(result.body.state);
      revision = result.body.revision;
      message =
        "Euer Plan wurde gerade auf dem anderen Gerät geändert. Der aktuelle Stand ist geladen; bitte wiederhole deine Auswahl.";
    } else if (!result.ok) throw new Error();
    else {
      state = validateState(result.body.state);
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
  if (e.target.dataset.check) {
    const key = e.target.dataset.check;
    change({
      ...state,
      checked: e.target.checked
        ? [...state.checked, key]
        : state.checked.filter((k) => k !== key),
    });
  }
});
root.addEventListener("input", (e) => {
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
  state = validateState(result.body.state);
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
      if (raw) state = validateState(JSON.parse(raw));
    } catch {
      message =
        "Der lokale Plan konnte nicht gelesen werden. Er wurde nicht überschrieben.";
      mode = "storage-error";
    }
  }
  render();
}
// Keine Hintergrund-Neudarstellung während einer geöffneten Rezeptauswahl.
setInterval(async () => {
  const next = nextWorkdays();
  if (next.join() !== dates.join()) {
    dates = next;
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
      state = validateState(r.body.state);
      revision = r.body.revision;
      render();
    }
  } catch {
    /* Offline-Änderungen werden erst nach bestätigtem Speichern übernommen. */
  }
}, 10000);
boot();
