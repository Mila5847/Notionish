// Home Assistant add-on entrypoint: resolves configuration from the add-on
// options and the MariaDB service, applies migrations, then starts the API.
import { mkdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const log = (...args) => console.log("[notionish]", ...args);

async function readOptions() {
  try {
    return JSON.parse(await readFile("/data/options.json", "utf8"));
  } catch {
    return {};
  }
}

async function databaseUrl(options) {
  if (options.database_url) return options.database_url;

  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) throw new Error("No database_url configured and not running under the Home Assistant Supervisor");

  const res = await fetch("http://supervisor/services/mysql", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const svc = (await res.json().catch(() => null))?.data;
  if (!res.ok || !svc?.host) {
    throw new Error("MariaDB service not available. Install and start the official MariaDB add-on, or set database_url.");
  }
  const name = options.database_name || "notionish";
  const user = encodeURIComponent(svc.username);
  const pass = encodeURIComponent(svc.password);
  return `mysql://${user}:${pass}@${svc.host}:${svc.port}/${encodeURIComponent(name)}`;
}

try {
  const options = await readOptions();
  process.env.DATABASE_URL = await databaseUrl(options);
  if (options.unsplash_access_key) process.env.UNSPLASH_ACCESS_KEY = options.unsplash_access_key;
  await mkdir(process.env.UPLOAD_DIR ?? "/data/uploads", { recursive: true });

  log("applying database migrations");
  const migrate = spawnSync("node_modules/.bin/prisma", ["migrate", "deploy"], {
    cwd: "/app",
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);

  log("starting");
  await import("/app/dist/index.js");
} catch (err) {
  console.error("[notionish]", err instanceof Error ? err.message : err);
  process.exit(1);
}
