// @vitest-environment node
/**
 * Parity guard: the browser search (`searchIconIndex` over the corpus) must
 * return exactly what the server text search returns. Runs the real SQL in
 * `queries.ts` against a temporary SQLite database built from the checked-in
 * migration, so it also pins the positional row encoding of
 * `getIconCorpusChunk`.
 */
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { getIconCorpusChunk, getIconCorpusManifest, getSearchCount, searchIcons } from "@/lib/queries";
import { decodeIconCorpusRow } from "@/lib/icon-corpus-format";
import { createIconSearchEntry, createIconSearchIndex, searchIconIndex, type IconSearchIndex } from "@/lib/icon-search";

const dbPath = vi.hoisted(() => `${Date.now()}-${Math.random().toString(36).slice(2)}.db`);

vi.mock("@/lib/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("@/lib/schema");
  const { tmpdir: osTmpdir } = await import("node:os");
  const { join: joinPath } = await import("node:path");
  const client = createClient({ url: `file:${joinPath(osTmpdir(), `unicon-parity-${dbPath}`)}` });
  return { db: drizzle(client, { schema }) };
});

interface FixtureIcon {
  id: string;
  name: string;
  normalizedName: string;
  category?: string | null;
  tags?: string | null;
  strokeWidth?: string | null;
  brandColor?: string | null;
  defaultStroke?: number | null;
  defaultFill?: number | null;
}

// Covers ties on normalized_name across sources, aliases, Python-style JSON
// tags, null tags, mixed case, and LIKE wildcard characters. (Malformed tags
// make the server JSON column throw, so they are covered in icon-corpus.test.)
const FIXTURES: FixtureIcon[] = [
  { id: "lucide:arrow-left", name: "ArrowLeft", normalizedName: "arrow-left", category: "arrows", tags: '["direction", "back"]', strokeWidth: "2", defaultStroke: 1 },
  { id: "phosphor:arrow-left", name: "ArrowLeft", normalizedName: "arrow-left", category: "arrows", tags: '["navigation"]', defaultFill: 1 },
  { id: "tabler:arrow-left", name: "arrow-left", normalizedName: "arrow-left", category: "Arrows", tags: "[]" },
  { id: "lucide:arrow-right", name: "ArrowRight", normalizedName: "arrow-right", category: "arrows", tags: '["forward"]' },
  { id: "lucide:check", name: "Check", normalizedName: "check", tags: '["done", "tick"]' },
  { id: "tabler:circle-check", name: "circle-check", normalizedName: "circle-check", tags: null },
  { id: "lucide:settings", name: "Settings", normalizedName: "settings", category: "system", tags: '["cog", "gear"]' },
  { id: "remix:settings-2-line", name: "Settings2Line", normalizedName: "settings-2-line", category: "System", tags: '["preferences"]' },
  { id: "heroicons:home", name: "HomeModern", normalizedName: "home", tags: '["house"]' },
  { id: "simple-icons:github", name: "GitHub", normalizedName: "github", tags: '["git", "code"]', brandColor: "#181717", defaultFill: 1 },
  { id: "simple-icons:100", name: "100%", normalizedName: "100", tags: '["percent"]' },
  { id: "feather:x", name: "X", normalizedName: "x", tags: '["close", "cancel"]' },
  { id: "iconoir:x-circle", name: "XCircle", normalizedName: "x-circle", tags: '["close"]' },
  { id: "hugeicons:user_add", name: "UserAdd", normalizedName: "user_add", tags: '["person"]' },
  { id: "lucide:user-plus", name: "UserPlus", normalizedName: "user-plus", category: "account", tags: '["person", "add"]' },
];

const QUERIES = ["", "arrow", "ARROW", "left", "checkmark", "cog", "gear", "home", "house", "git", "100%", "x", "close", "user_add", "user%plus", "a", "zzz", '", "', "direction", "  arrow  "];
const FILTERS: Array<{ sourceId?: string; category?: string }> = [
  {},
  { sourceId: "lucide" },
  { sourceId: "tabler" },
  { category: "arrows" },
  { sourceId: "remix", category: "System" },
];
const PAGE_SIZE = 3;

let index: IconSearchIndex;

beforeAll(async () => {
  const migration = readFileSync(join(process.cwd(), "drizzle/0000_worthless_hellcat.sql"), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) await db.$client.execute(statement);
  }

  for (const source of new Set(FIXTURES.map((icon) => icon.id.split(":")[0]!))) {
    await db.$client.execute({
      sql: "INSERT INTO sources (id, name, version, extracted_at) VALUES (?, ?, '1', 1700000000)",
      args: [source, source],
    });
  }
  for (const icon of FIXTURES) {
    await db.$client.execute({
      sql: `INSERT INTO icons (id, source_id, name, normalized_name, category, tags, view_box, content,
              default_stroke, default_fill, stroke_width, brand_color)
            VALUES (?, ?, ?, ?, ?, ?, '0 0 24 24', ?, ?, ?, ?, ?)`,
      args: [
        icon.id, icon.id.split(":")[0]!, icon.name, icon.normalizedName, icon.category ?? null,
        icon.tags === undefined ? "[]" : icon.tags, `<path d="${icon.id}"/>`,
        icon.defaultStroke ?? null, icon.defaultFill ?? null, icon.strokeWidth ?? null, icon.brandColor ?? null,
      ],
    });
  }

  const manifest = await getIconCorpusManifest();
  const chunks = await Promise.all(
    Array.from({ length: manifest.chunks }, (_, chunk) => getIconCorpusChunk(chunk)),
  );
  expect(chunks.every((chunk) => chunk.version === manifest.version)).toBe(true);
  index = createIconSearchIndex(
    chunks.flatMap((chunk) => chunk.rows.map((row) => createIconSearchEntry(decodeIconCorpusRow(row), row[5]))),
  );
});

afterAll(() => {
  db.$client.close();
  rmSync(join(tmpdir(), `unicon-parity-${dbPath}`), { force: true });
});

describe("local search parity with SQL text search", () => {
  it("should load every fixture icon through the corpus chunks", () => {
    expect(index.entries).toHaveLength(FIXTURES.length);
  });

  const cases = QUERIES.flatMap((query) => FILTERS.map((filter) => ({ query, ...filter })));

  it.each(cases)("should match for %j", async ({ query, sourceId, category }) => {
    const params = { ...(query ? { query } : {}), ...(sourceId ? { sourceId } : {}), ...(category ? { category } : {}) };
    const total = Number(await getSearchCount(params));

    for (let offset = 0; offset <= total; offset += PAGE_SIZE) {
      const serverRows = await searchIcons({ ...params, limit: PAGE_SIZE + 1, offset });
      const local = searchIconIndex(index, { query, sourceId, category, limit: PAGE_SIZE, offset });

      expect(local.icons).toEqual(serverRows.slice(0, PAGE_SIZE));
      expect(local.total).toBe(total);
      expect(local.hasMore).toBe(serverRows.length > PAGE_SIZE);
    }
  });
});
