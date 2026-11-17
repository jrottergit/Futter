import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { emptyState } from "../src/core.js";
test("shared household requires login, blocks CSRF and prevents stale overwrites", async () => {
  const { app, close } = createApp({
    password: "a-test-password-long-enough",
    secret: "a-test-secret-with-at-least-32-characters",
    dbPath: ":memory:",
    today: () => "2026-11-16",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  const request = (path, method = "GET", body, cookie) =>
    fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    assert.equal((await request("state")).status, 401);
    assert.equal(
      (await request("login", "POST", { password: "wrong" })).status,
      401,
    );
    const login = await request("login", "POST", {
      password: "a-test-password-long-enough",
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert(login.headers.get("set-cookie").includes("HttpOnly"));
    const initial = await (await request("state", "GET", null, cookie)).json();
    assert.equal(initial.revision, 0);
    const state = { ...emptyState(), plan: { "2026-11-16": "gnocchi" } };
    const put = await request("state", "PUT", { state, revision: 0 }, cookie);
    assert.equal(put.status, 200);
    const stale = await request(
      "state",
      "PUT",
      { state: emptyState(), revision: 0 },
      cookie,
    );
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).state.plan["2026-11-16"], "gnocchi");
    const second = await request("login", "POST", {
        password: "a-test-password-long-enough",
      }),
      cookie2 = second.headers.get("set-cookie").split(";")[0];
    assert.equal(
      (await (await request("state", "GET", null, cookie2)).json()).state.plan[
        "2026-11-16"
      ],
      "gnocchi",
    );
    assert.equal(
      (
        await fetch(base + "state", {
          method: "PUT",
          headers: {
            Cookie: cookie,
            Origin: "https://attacker.example",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state, revision: 1 }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          "state",
          "PUT",
          { state: { ...state, plan: { "2026-11-16": "bad" } }, revision: 1 },
          cookie,
        )
      ).status,
      400,
    );
    await request("logout", "POST", {}, cookie);
    assert.equal((await request("state", "GET", null, cookie)).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
    close();
  }
});

test("production proxy sets secure cookies and validates HTTPS origin", async () => {
  const { app, close } = createApp({
    password: "a-test-password-long-enough",
    secret: "a-test-secret-with-at-least-32-characters",
    dbPath: ":memory:",
    today: () => "2026-11-16",
    production: true,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const host = `127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`http://${host}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `https://${host}`,
        "X-Forwarded-Proto": "https",
      },
      body: JSON.stringify({ password: "a-test-password-long-enough" }),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie"), /; Secure;/);
    assert.match(response.headers.get("set-cookie"), /SameSite=Strict/);
  } finally {
    await new Promise((r) => server.close(r));
    close();
  }
});

test("parallel password checks are bounded without blocking all API access", async () => {
  const { app, close } = createApp({
    password: "a-test-password-long-enough",
    secret: "a-test-secret-with-at-least-32-characters",
    dbPath: ":memory:",
    today: () => "2026-11-16",
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const attempts = Array.from({ length: 6 }, () =>
      fetch(base + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong" }),
      }),
    );
    const status = await fetch(base + "/api/session");
    assert.equal(status.status, 200);
    const responses = await Promise.all(attempts);
    assert(responses.some((r) => r.status === 429));
    assert(responses.every((r) => [401, 429].includes(r.status)));
  } finally {
    await new Promise((r) => server.close(r));
    close();
  }
});

test("server migrates stored v1, cleans by Berlin day and rejects obsolete devices", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(tmpdir() + "/futter-calendar-"),
    file = dir + "/test.sqlite";
  const seed = new DatabaseSync(file);
  seed.exec(
    "CREATE TABLE household(id INTEGER PRIMARY KEY,revision INTEGER,state TEXT)",
  );
  seed.prepare("INSERT INTO household VALUES (1,4,?)").run(
    JSON.stringify({
      version: 1,
      plan: { "2026-11-20": "gnocchi", "2026-11-23": "couscous" },
      checked: [],
    }),
  );
  seed.close();
  let day = "2026-11-20";
  const { app, close } = createApp({
    password: "calendar-test-password-long",
    secret: "calendar-test-secret-at-least-32-characters",
    dbPath: file,
    today: () => day,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/`;
  let cookie = "";
  const call = async (path, method = "GET", body) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const login = await call("login", "POST", {
      password: "calendar-test-password-long",
    });
    cookie = login.headers.get("set-cookie").split(";")[0];
    let initial = await (await call("state")).json();
    assert.equal(initial.revision, 5);
    assert.equal(initial.state.version, 3);
    const state = {
      ...initial.state,
      manualItems: [
        { id: "coffee", name: "Kaffee", category: "Vorrat", checkedOn: null },
        {
          id: "soap",
          name: "Spülmittel",
          category: "Haushalt",
          checkedOn: "2099-01-01",
        },
      ],
    };
    const saved = await (
      await call("state", "PUT", { state, revision: initial.revision })
    ).json();
    assert.equal(saved.state.manualItems[1].checkedOn, "2026-11-20");
    day = "2026-11-21";
    const next = await (await call("state")).json();
    assert.equal(next.revision, saved.revision + 1);
    assert.deepEqual(next.state.plan, { "2026-11-23": "couscous" });
    assert.deepEqual(
      next.state.manualItems.map((i) => i.id),
      ["coffee"],
    );
    assert.equal(
      (
        await call("state", "PUT", {
          state: saved.state,
          revision: saved.revision,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call("state", "PUT", {
          state: { version: 1, plan: {}, checked: [] },
          revision: next.revision,
        })
      ).status,
      409,
    );
    const read = new DatabaseSync(file);
    const persisted = JSON.parse(
      read.prepare("SELECT state FROM household").get().state,
    );
    read.close();
    assert.deepEqual(persisted, next.state);
  } finally {
    await new Promise((r) => server.close(r));
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});
