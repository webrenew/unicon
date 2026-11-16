/**
 * In-memory icon text search.
 *
 * Mirrors the SQL text search in `queries.ts` (`buildSearchConditions` +
 * `searchIcons` + `getSearchCount`) so the browser can answer searches locally
 * with identical results once the icon corpus is loaded:
 *
 * - source and category are exact-match filters
 * - the query is expanded with aliases, and an icon matches when any expanded
 *   term is a case-insensitive `LIKE '%term%'` match on its normalized name,
 *   name, or raw JSON tags string (`%` and `_` keep their LIKE meaning)
 * - results are ordered by normalized name, then id
 */
import { expandSearchQuery } from "./icon-aliases";
import type { IconData } from "@/types/icon";

export interface IconSearchEntry {
  icon: IconData;
  normalizedNameLower: string;
  nameLower: string;
  /** Lowercased raw JSON tags string, exactly as stored in the database. */
  tagsLower: string;
}

export interface IconSearchIndex {
  /** Entries sorted by normalized name, then id. */
  entries: IconSearchEntry[];
}

export interface IconSearchParams {
  query?: string | undefined;
  sourceId?: string | undefined;
  category?: string | undefined;
  limit: number;
  offset: number;
}

export interface IconSearchResult {
  icons: IconData[];
  total: number;
  hasMore: boolean;
}

type TermMatcher = (haystack: string) => boolean;

const LIKE_WILDCARD_PATTERN = /[%_]/;
const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

/** Build a matcher equivalent to SQLite `haystack LIKE '%term%'` on lowercased input. */
function createTermMatcher(term: string): TermMatcher {
  if (!LIKE_WILDCARD_PATTERN.test(term)) {
    return (haystack) => haystack.includes(term);
  }

  let pattern = "";
  for (const character of term) {
    if (character === "%") pattern += ".*";
    else if (character === "_") pattern += ".";
    else pattern += character.replace(REGEX_SPECIAL_CHARACTERS, "\\$&");
  }
  const regex = new RegExp(pattern, "s");
  return (haystack) => regex.test(haystack);
}

/** Compare by normalized name, then id, matching the SQL `ORDER BY`. */
export function compareIconOrder(
  a: Pick<IconData, "normalizedName" | "id">,
  b: Pick<IconData, "normalizedName" | "id">,
): number {
  if (a.normalizedName !== b.normalizedName) return a.normalizedName < b.normalizedName ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * Create a search entry for an icon.
 *
 * @param icon - Icon to index
 * @param rawTags - Tags as stored in the database (a JSON string). Defaults to
 *   `JSON.stringify(icon.tags)` when the raw value is not available.
 */
export function createIconSearchEntry(icon: IconData, rawTags?: string | null): IconSearchEntry {
  return {
    icon,
    normalizedNameLower: icon.normalizedName.toLowerCase(),
    nameLower: icon.name.toLowerCase(),
    tagsLower: (rawTags ?? JSON.stringify(icon.tags)).toLowerCase(),
  };
}

/**
 * Build a search index. Entries are deduplicated by icon id and sorted, so
 * callers can pass chunks in any order.
 */
export function createIconSearchIndex(entries: IconSearchEntry[]): IconSearchIndex {
  const byId = new Map<string, IconSearchEntry>();
  for (const entry of entries) byId.set(entry.icon.id, entry);
  const sorted = Array.from(byId.values()).sort((a, b) => compareIconOrder(a.icon, b.icon));
  return { entries: sorted };
}

/** Search the index with the same semantics as the server text search. */
export function searchIconIndex(index: IconSearchIndex, params: IconSearchParams): IconSearchResult {
  const { sourceId, category, limit, offset } = params;
  const trimmedQuery = params.query?.trim() ?? "";
  const matchers = trimmedQuery
    ? expandSearchQuery(trimmedQuery).map((term) => createTermMatcher(term.toLowerCase()))
    : [];

  const pageEnd = offset + limit;
  const icons: IconData[] = [];
  let total = 0;

  for (const entry of index.entries) {
    if (sourceId && entry.icon.sourceId !== sourceId) continue;
    if (category && entry.icon.category !== category) continue;
    if (matchers.length > 0 && !matchers.some((matches) =>
      matches(entry.normalizedNameLower) || matches(entry.nameLower) || matches(entry.tagsLower)
    )) {
      continue;
    }

    if (total >= offset && total < pageEnd) icons.push(entry.icon);
    total++;
  }

  return { icons, total, hasMore: total > pageEnd };
}
