import express from "express";
import session from "express-session";
import memorystore from "memorystore";
import { rateLimit } from "express-rate-limit";
import { scryptSync, scrypt, timingSafeEqual, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  validateState,
  emptyState,
  cleanState,
  localDate,
} from "../src/core.js";
import path from "node:path";
import { promisify } from "node:util";
const derivePassword = promisify(scrypt);
import { fileURLToPath } from "node:url";

export function createApp({
  password,
  secret,
  dbPath,
  production = false,
  today = () => localDate(),
}) {
  if (!password || password.length < 16)
    throw new Error("FUTTER_PASSWORD muss mindestens 16 Zeichen haben.");
  if (!secret || secret.length < 32)
    throw new Error("FUTTER_SESSION_SECRET muss mindestens 32 Zeichen haben.");
  const salt = randomBytes(16),
    passwordHash = scryptSync(password, salt, 64);
  const db = new DatabaseSync(dbPath);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS household (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, state TEXT NOT NULL)",
  );
  db.prepare("INSERT OR IGNORE INTO household VALUES (1,0,?)").run(
    JSON.stringify(emptyState()),
  );
  const snapshot = () => {
    const row = db
      .prepare("SELECT revision,state FROM household WHERE id=1")
      .get();
    const state = cleanState(validateState(JSON.parse(row.state)), today());
    const serialized = JSON.stringify(state);
    if (serialized !== row.state) {
      db.prepare(
        "UPDATE household SET revision=revision+1,state=? WHERE id=1 AND revision=?",
      ).run(serialized, row.revision);
      row.revision++;
    }
    return { revision: row.revision, state, today: today() };
  };
  snapshot();
  const cleanupTimer = setInterval(snapshot, 60000);
  cleanupTimer.unref();
  const app = express();
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", "loopback");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (["POST", "PUT", "DELETE"].includes(req.method)) {
      const origin = req.get("origin");
      if (
        (origin && origin !== `${req.protocol}://${req.get("host")}`) ||
        req.get("sec-fetch-site") === "cross-site"
      )
        return res
          .status(403)
          .json({ error: "Fremder Ursprung nicht erlaubt." });
      if (!req.is("application/json"))
        return res.status(415).json({ error: "JSON erforderlich." });
    }
    next();
  });
  app.use(express.json({ limit: "128kb" }));
  // Ein Prozess/ein Haushalt: Sessions liegen absichtlich nur im RAM und enden bei Server-Neustart.
  const MemoryStore = memorystore(session);
  const store = new MemoryStore({ checkPeriod: 60 * 60 * 1000, max: 100 });
  app.use(
    "/api",
    session({
      name: "futter.sid",
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: production,
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.get("/api/session", (req, res) =>
    res.json({ authenticated: req.session.authenticated === true }),
  );
  let activePasswordChecks = 0;
  app.post(
    "/api/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 3,
      skipSuccessfulRequests: true,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (req, res) => {
        const seconds = Math.max(1, Math.ceil(
          ((req.rateLimit.resetTime?.getTime() || Date.now() + 900000) - Date.now()) / 1000,
        ));
        res.set("Retry-After", String(seconds));
        res.status(429).json({
          error: `Zu viele Fehlversuche. Bitte in ${Math.ceil(seconds / 60)} Minuten erneut versuchen.`,
        });
      },
    }),
    async (req, res, next) => {
      const input = req.body?.password;
      if (typeof input !== "string" || input.length > 512)
        return res.status(401).json({ error: "Passwort stimmt nicht." });
      if (activePasswordChecks >= 2)
        return res
          .status(429)
          .json({ error: "Anmeldung ausgelastet. Bitte kurz warten." });
      activePasswordChecks++;
      let valid;
      try {
        valid = timingSafeEqual(
          await derivePassword(input, salt, 64),
          passwordHash,
        );
      } catch (error) {
        return next(error);
      } finally {
        activePasswordChecks--;
      }
      if (!valid)
        return res.status(401).json({ error: "Passwort stimmt nicht." });
      req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.authenticated = true;
        req.session.save((error) =>
          error ? next(error) : res.json({ ok: true }),
        );
      });
    },
  );
  app.post("/api/logout", (req, res, next) =>
    req.session.destroy((error) => {
      if (error) return next(error);
      res
        .clearCookie("futter.sid", {
          httpOnly: true,
          secure: production,
          sameSite: "strict",
        })
        .json({ ok: true });
    }),
  );
  app.use("/api", (req, res, next) =>
    req.session.authenticated === true
      ? next()
      : res.status(401).json({ error: "Bitte anmelden." }),
  );
  app.get("/api/state", (req, res) => res.json(snapshot()));
  app.put("/api/state", (req, res) => {
    const current = snapshot();
    if ([1, 2].includes(req.body?.state?.version))
      return res
        .status(409)
        .json({ ...current, error: "Bitte die App neu laden." });
    let state;
    try {
      state = cleanState(validateState(req.body?.state), today());
      const existing = new Map(
        current.state.manualItems.map((item) => [item.id, item]),
      );
      state.manualItems = state.manualItems.map((item) => ({
        ...item,
        checkedOn:
          item.checkedOn === null
            ? null
            : existing.get(item.id)?.checkedOn || today(),
      }));
      state = cleanState(state, today());
      if (!Number.isSafeInteger(req.body.revision) || req.body.revision < 0)
        throw new Error("Ungültige Revision");
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const result = db
      .prepare(
        "UPDATE household SET revision=revision+1,state=? WHERE id=1 AND revision=?",
      )
      .run(JSON.stringify(state), req.body.revision);
    if (result.changes === 0) return res.status(409).json(snapshot());
    res.json(snapshot());
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Unbekannter API-Pfad." }),
  );
  const dist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../dist",
  );
  app.use(express.static(dist));
  app.get("/", (req, res) => res.sendFile(path.join(dist, "index.html")));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    res
      .status(
        error.type === "entity.too.large"
          ? 413
          : error instanceof SyntaxError
            ? 400
            : 500,
      )
      .json({ error: "Anfrage konnte nicht verarbeitet werden." });
  });
  return {
    app,
    close: () => {
      clearInterval(cleanupTimer);
      store.stopInterval();
      store.clear();
      db.close();
    },
  };
}
