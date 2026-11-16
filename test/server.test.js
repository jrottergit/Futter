import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { emptyState } from "../src/core.js";
test("shared household requires login, blocks CSRF and prevents stale overwrites", async () => {
  const { app, close } = createApp({
    password: "a-test-password-long-enough",
    secret: "a-test-secret-with-at-least-32-characters",
    dbPath: ":memory:",
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
