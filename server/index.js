import { mkdirSync } from "node:fs";
import { createApp } from "./app.js";
import path from "node:path";
const dataDirectory = process.env.FUTTER_DATA_DIR || "data";
mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
const { app, close } = createApp({
  password: process.env.FUTTER_PASSWORD,
  secret: process.env.FUTTER_SESSION_SECRET,
  dbPath: path.join(dataDirectory, "futter.sqlite"),
  production: process.env.NODE_ENV === "production",
});
const server = app.listen(Number(process.env.PORT || 8788), "127.0.0.1", () =>
  console.log(
    "Futter läuft auf http://127.0.0.1:" + (process.env.PORT || 8788),
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      close();
      process.exit(0);
    }),
  );
