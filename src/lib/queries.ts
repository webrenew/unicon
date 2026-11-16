import { db } from "./db";
import { icons, sources } from "./schema";
import { eq, like, or, sql, asc } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type { IconData, SourceData } from "@/types/icon";
import { expandSearchQuery } from "./icon-aliases";
import { ICON_CORPUS_CHUNK_SIZE, ICON_CORPUS_FLAGS, type IconCorpusManifest, type IconCorpusRow } from "./icon-corpus-format";

/**
 * Get all icon sources with their stats.
 */
export async function getSources(): Promise<SourceData[]> {
  const results = await db.select().from(sources).orderBy(asc(sources.name));
  return results.map((s) => ({
    id: s.id,
    name: s.name,
    version: s.version,
    license: s.license,
    totalIcons: s.totalIcons,
    extractedAt: s.extractedAt,
  }));
}

/**
 * Build search conditions for reuse between searchIcons and getSearchCount.
 * Expands query with aliases (e.g., "checkmark" also searches for "check").
 */
function buildSearchConditions(params: {
  query?: string;
  sourceId?: string;
  category?: string;
}) {
  const { query, sourceId, category } = params;
  const conditions = [];

  if (sourceId) {
    conditions.push(eq(icons.sourceId, sourceId));
  }

  if (category) {
    conditions.push(eq(icons.category, category));
  }

  if (query && query.trim()) {
    // Expand query with aliases (e.g., "checkmark" -> ["checkmark", "check", "check-circle"])
    const expandedTerms = expandSearchQuery(query);

    // Build OR conditions for all expanded terms
    const termConditions = expandedTerms.map((term) => {
      const searchTerm = `%${term.toLowerCase()}%`;
      return or(
        like(sql`lower(${icons.normalizedName})`, searchTerm),
        like(sql`lower(${icons.name})`, searchTerm),
        like(sql`lower(${icons.tags})`, searchTerm)
      );
    });

    // Combine all term conditions with OR
    if (termConditions.length === 1) {
      conditions.push(termConditions[0]);
    } else if (termConditions.length > 1) {
      conditions.push(or(...termConditions));
    }
  }

  return conditions;
}

/**
 * Search icons with optional filters.
 * Uses a lightweight select to avoid fetching embeddings and pathData.
 */
export async function searchIcons(params: {
  query?: string;
  sourceId?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<IconData[]> {
  const { limit = 100, offset = 0 } = params;
  const conditions = buildSearchConditions(params);

  // Select only the fields needed for display (skip embedding, pathData)
  const results = await db
    .select({
      id: icons.id,
      name: icons.name,
      normalizedName: icons.normalizedName,
      sourceId: icons.sourceId,
      category: icons.category,
      tags: icons.tags,
      viewBox: icons.viewBox,
      content: icons.content,
      defaultStroke: icons.defaultStroke,
      defaultFill: icons.defaultFill,
      strokeWidth: icons.strokeWidth,
      brandColor: icons.brandColor,
    })
    .from(icons)
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
    // Tie-break by id so ordering is deterministic and matches the client-side
    // corpus search (`compareIconOrder` in icon-search.ts).
    .orderBy(asc(icons.normalizedName), asc(icons.id))
    .limit(limit)
    .offset(offset);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    sourceId: row.sourceId,
    category: row.category,
    tags: (row.tags as string[]) ?? [],
    viewBox: row.viewBox,
    content: row.content,
    pathData: null,
    defaultStroke: row.defaultStroke ?? false,
    defaultFill: row.defaultFill ?? false,
    strokeWidth: row.strokeWidth,
    brandColor: row.brandColor ?? null,
  }));
}

/**
 * Get total count of icons matching search criteria.
 * Used for accurate pagination metadata.
 */
export async function getSearchCount(params: {
  query?: string;
  sourceId?: string;
  category?: string;
}): Promise<number> {
  const conditions = buildSearchConditions(params);

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(icons)
    .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined);

  return result[0]?.count ?? 0;
}

/**
 * Get a single icon by ID.
 */
export async function getIconById(id: string): Promise<IconData | null> {
  const results = await db.select().from(icons).where(eq(icons.id, id)).limit(1);

  const first = results[0];
  if (!first) {
    return null;
  }

  return mapIconRow(first);
}

/**
 * Get icons by their normalized names (for starter packs).
 * Returns icons matching any of the provided names.
 * Prefers Lucide icons when the same name exists in multiple libraries.
 */
export async function getIconsByNames(names: string[], preferredSource: string = "lucide"): Promise<IconData[]> {
  if (names.length === 0) return [];

  // Normalize names for matching
  const normalizedNames = names.map((n) => n.toLowerCase());

  // Use SQL IN clause for exact matching
  // Order by source priority: preferred source comes LAST so it overwrites in Map
  const results = await db
    .select({
      id: icons.id,
      name: icons.name,
      normalizedName: icons.normalizedName,
      sourceId: icons.sourceId,
      category: icons.category,
      tags: icons.tags,
      viewBox: icons.viewBox,
      content: icons.content,
      defaultStroke: icons.defaultStroke,
      defaultFill: icons.defaultFill,
      strokeWidth: icons.strokeWidth,
      brandColor: icons.brandColor,
    })
    .from(icons)
    .where(sql`lower(${icons.normalizedName}) IN ${normalizedNames}`)
    .orderBy(
      // Sort preferred source LAST so it wins in Map deduplication
      sql`CASE WHEN ${icons.sourceId} = ${preferredSource} THEN 1 ELSE 0 END`,
      asc(icons.normalizedName)
    );

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    sourceId: row.sourceId,
    category: row.category,
    tags: (row.tags as string[]) ?? [],
    viewBox: row.viewBox,
    content: row.content,
    pathData: null,
    defaultStroke: row.defaultStroke ?? false,
    defaultFill: row.defaultFill ?? false,
    strokeWidth: row.strokeWidth,
    brandColor: row.brandColor ?? null,
  }));
}

/**
 * Get icons by their IDs (batch query for MCP get_multiple_icons).
 * Returns icons matching any of the provided IDs in format 'source:name'.
 */
export async function getIconsByIds(ids: string[]): Promise<IconData[]> {
  if (ids.length === 0) return [];

  // Use SQL IN clause for exact ID matching
  const results = await db
    .select({
      id: icons.id,
      name: icons.name,
      normalizedName: icons.normalizedName,
      sourceId: icons.sourceId,
      category: icons.category,
      tags: icons.tags,
      viewBox: icons.viewBox,
      content: icons.content,
      defaultStroke: icons.defaultStroke,
      defaultFill: icons.defaultFill,
      strokeWidth: icons.strokeWidth,
      brandColor: icons.brandColor,
    })
    .from(icons)
    .where(sql`${icons.id} IN ${ids}`);

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    sourceId: row.sourceId,
    category: row.category,
    tags: (row.tags as string[]) ?? [],
    viewBox: row.viewBox,
    content: row.content,
    pathData: null,
    defaultStroke: row.defaultStroke ?? false,
    defaultFill: row.defaultFill ?? false,
    strokeWidth: row.strokeWidth,
    brandColor: row.brandColor ?? null,
  }));
}


/**
 * Get icon count by source.
 */
const getCachedIconCountBySource = unstable_cache(
  async () => {
    const results = await db
      .select({
        sourceId: icons.sourceId,
        count: sql<number>`count(*)`,
      })
      .from(icons)
      .groupBy(icons.sourceId);

    return Object.fromEntries(results.map((r) => [r.sourceId, r.count]));
  },
  ["icon-count-by-source-v1"],
  {
    revalidate: 60 * 15,
    tags: ["icon-metadata"],
  }
);

export async function getIconCountBySource(): Promise<Record<string, number>> {
  return getCachedIconCountBySource();
}

/**
 * Get total icon count.
 */
const getCachedTotalIconCount = unstable_cache(
  async () => {
    const result = await db.select({ count: sql<number>`count(*)` }).from(icons);
    return result[0]?.count ?? 0;
  },
  ["icon-total-count-v1"],
  {
    revalidate: 60 * 15,
    tags: ["icon-metadata"],
  }
);

export async function getTotalIconCount(): Promise<number> {
  return getCachedTotalIconCount();
}

/**
 * Get unique categories.
 */
const getCachedCategories = unstable_cache(
  async () => {
    const results = await db
      .selectDistinct({ category: icons.category })
      .from(icons)
      .where(sql`${icons.category} IS NOT NULL`)
      .orderBy(asc(icons.category));

    return results.map((r) => r.category).filter((c): c is string => c !== null);
  },
  ["icon-categories-v1"],
  {
    revalidate: 60 * 15,
    tags: ["icon-metadata"],
  }
);

export async function getCategories(): Promise<string[]> {
  return getCachedCategories();
}


/**
 * Get the icon corpus manifest: a version that changes when icons are
 * re-extracted, plus the chunk layout for `getIconCorpusChunk`.
 */
export async function getIconCorpusManifest(): Promise<IconCorpusManifest> {
  const [countRows, sourceRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(icons),
    db.select({ latest: sql<number | null>`max(${sources.extractedAt})` }).from(sources),
  ]);
  const total = Number(countRows[0]?.count ?? 0);
  const latestExtraction = Number(sourceRows[0]?.latest ?? 0);

  return {
    version: `${total}-${latestExtraction}`,
    total,
    chunkSize: ICON_CORPUS_CHUNK_SIZE,
    chunks: Math.ceil(total / ICON_CORPUS_CHUNK_SIZE),
  };
}

interface IconCorpusDbRow {
  id: string;
  name: string;
  normalizedName: string;
  sourceId: string;
  category: string | null;
  tags: string | null;
  viewBox: string;
  content: string;
  defaultStroke: number | null;
  defaultFill: number | null;
  strokeWidth: string | null;
  brandColor: string | null;
}

/**
 * Get one chunk of the icon corpus in search order (normalized name, then id).
 * Tags stay as the raw JSON string so client-side matching is byte-identical
 * to the SQL `lower(tags) LIKE` search.
 */
export async function getIconCorpusChunk(chunk: number): Promise<IconCorpusRow[]> {
  const rows = (await db.all(sql`
    SELECT
      id, name, normalized_name AS normalizedName, source_id AS sourceId,
      category, tags, view_box AS viewBox, content,
      default_stroke AS defaultStroke, default_fill AS defaultFill,
      stroke_width AS strokeWidth, brand_color AS brandColor
    FROM icons
    ORDER BY normalized_name ASC, id ASC
    LIMIT ${ICON_CORPUS_CHUNK_SIZE} OFFSET ${chunk * ICON_CORPUS_CHUNK_SIZE}
  `)) as IconCorpusDbRow[];

  return rows.map((row) => [
    row.id,
    row.name,
    row.normalizedName,
    row.sourceId,
    row.category,
    row.tags,
    row.viewBox,
    row.content,
    (row.defaultStroke ? ICON_CORPUS_FLAGS.defaultStroke : 0) |
      (row.defaultFill ? ICON_CORPUS_FLAGS.defaultFill : 0),
    row.strokeWidth,
    row.brandColor,
  ]);
}

// Helper to map database row to IconData type
function mapIconRow(row: typeof icons.$inferSelect): IconData {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalizedName,
    sourceId: row.sourceId,
    category: row.category,
    tags: (row.tags as string[]) ?? [],
    viewBox: row.viewBox,
    content: row.content,
    pathData: row.pathData ?? null,
    defaultStroke: row.defaultStroke ?? false,
    defaultFill: row.defaultFill ?? false,
    strokeWidth: row.strokeWidth,
    brandColor: row.brandColor ?? null,
  };
}
