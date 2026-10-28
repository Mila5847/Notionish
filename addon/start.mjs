// Home Assistant add-on entrypoint: the database is SQLite in the add-on's /data. On the
// first start after the switch from MariaDB it imports the old MariaDB database once
// (from the MariaDB add-on's service, or `database_url`), then starts the API.
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const DB_FILE = "/data/notionish.db";
const log = (...args) => console.log("[notionish]", ...args);

async function readOptions() {
  try {
    return JSON.parse(await readFile("/data/options.json", "utf8"));
  } catch {
    return {};
  }
}

const exists = (path) => access(path).then(() => true, () => false);

/** The old MariaDB database to import, or null when there is none to import. */
async function mysqlSource(options) {
  if (options.database_url?.startsWith("mysql://")) return options.database_url;
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return null;
  const res = await fetch("http://supervisor/services/mysql", { headers: { Authorization: `Bearer ${token}` } });
  const svc = (await res.json().catch(() => null))?.data;
  if (!res.ok || !svc?.host) return null;
  const user = encodeURIComponent(svc.username);
  const pass = encodeURIComponent(svc.password);
  return `mysql://${user}:${pass}@${svc.host}:${svc.port}/${encodeURIComponent(options.database_name || "notionish")}`;
}

try {
  const options = await readOptions();
  process.env.DATABASE_URL = `file:${DB_FILE}`;
  if (options.unsplash_access_key) process.env.UNSPLASH_ACCESS_KEY = options.unsplash_access_key;
  await mkdir(process.env.UPLOAD_DIR ?? "/data/uploads", { recursive: true });
  const fresh = !(await exists(DB_FILE));

  log("applying database migrations");
  const migrate = spawnSync("node_modules/.bin/prisma", ["migrate", "deploy"], {
    cwd: "/app",
    stdio: "inherit",
    env: process.env,
  });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);

  if (fresh) {
    const source = await mysqlSource(options).catch(() => null);
    if (source) {
      log("importing the MariaDB database into SQLite");
      try {
        const { importFromMysql } = await import("/app/dist/tools/import-mysql.js");
        const counts = await importFromMysql(source);
        await writeFile("/data/imported-from-mariadb.json", JSON.stringify({ at: new Date(), counts }, null, 2));
        log("imported", JSON.stringify(counts));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/Unknown database|ER_BAD_DB_ERROR|doesn't exist/.test(message)) {
          log("no MariaDB database to import, starting empty");
        } else {
          // Leave no half-filled database: the next start tries again.
          await rm(DB_FILE, { force: true });
          throw new Error(`import from MariaDB failed: ${message}`);
        }
      }
    }
  }

  log("starting");
  await import("/app/dist/index.js");
} catch (err) {
  console.error("[notionish]", err instanceof Error ? err.message : err);
  process.exit(1);
}
