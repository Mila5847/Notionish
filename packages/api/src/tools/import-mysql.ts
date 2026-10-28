// One-time import of an existing MySQL/MariaDB Notionish database into the SQLite one
// (DATABASE_URL), which must already be migrated and still empty.
// Usage: node dist/tools/import-mysql.js mysql://user:pass@host:3306/notionish
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";

type Row = Record<string, unknown>;

/** Rows ordered so every row comes after the row its `parentKey` points to. */
function parentsFirst(rows: Row[], parentKey: string): Row[] {
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const done = new Set<string>();
  const out: Row[] = [];
  const visit = (row: Row) => {
    const id = row.id as string;
    if (done.has(id)) return;
    done.add(id);
    const parent = row[parentKey] as string | null;
    if (parent && byId.has(parent)) visit(byId.get(parent)!);
    out.push(row);
  };
  rows.forEach(visit);
  return out;
}

function json(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function importFromMysql(sourceUrl: string): Promise<Record<string, number>> {
  const source = await mysql.createConnection({ uri: sourceUrl, dateStrings: false });
  const target = new PrismaClient();
  const read = async (table: string) => (await source.query(`SELECT * FROM \`${table}\``))[0] as Row[];
  try {
    if ((await target.user.count()) > 0) throw new Error("the SQLite database is not empty");
    const users = await read("User");
    const workspaces = await read("Workspace");
    const memberships = await read("Membership");
    const pages = parentsFirst(await read("Page"), "parentPageId");
    const blocks = parentsFirst(await read("Block"), "parentBlockId");
    const assets = await read("Asset");
    const favorites = await read("Favorite");

    await target.$transaction(async (tx) => {
      // createMany for flat tables; parents-first order keeps the self-references valid.
      await tx.user.createMany({ data: users as never });
      await tx.workspace.createMany({ data: workspaces as never });
      await tx.membership.createMany({ data: memberships as never });
      for (const page of pages) await tx.page.create({ data: page as never });
      for (const block of blocks) await tx.block.create({ data: { ...block, content: json(block.content) } as never });
      await tx.asset.createMany({ data: assets as never });
      await tx.favorite.createMany({ data: favorites as never });
    }, { timeout: 600_000 });

    return {
      users: users.length, workspaces: workspaces.length, memberships: memberships.length,
      pages: pages.length, blocks: blocks.length, assets: assets.length, favorites: favorites.length,
    };
  } finally {
    await source.end();
    await target.$disconnect();
  }
}

if (process.argv[1]?.endsWith("import-mysql.js") && process.argv[2]) {
  importFromMysql(process.argv[2])
    .then((counts) => console.log("imported", counts))
    .catch((err) => {
      console.error("import failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
