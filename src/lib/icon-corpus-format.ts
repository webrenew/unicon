/**
 * Wire format for the icon corpus served by `GET /api/icons/corpus`.
 *
 * The corpus lets the browser search every icon locally. It is split into
 * chunks so each response stays well below the Vercel Function response limit
 * (4.5 MB); 3000 icons is about 2.3 MB of JSON, about 600 KB with brotli.
 */
import type { IconData } from "@/types/icon";

export const ICON_CORPUS_CHUNK_SIZE = 3000;

/** Bit flags packed into `IconCorpusRow[8]`. */
export const ICON_CORPUS_FLAGS = {
  defaultStroke: 1,
  defaultFill: 2,
} as const;

/**
 * Compact positional row:
 * [id, name, normalizedName, sourceId, category, rawTagsJson, viewBox, content, flags, strokeWidth, brandColor]
 */
export type IconCorpusRow = [
  id: string,
  name: string,
  normalizedName: string,
  sourceId: string,
  category: string | null,
  rawTags: string | null,
  viewBox: string,
  content: string,
  flags: number,
  strokeWidth: string | null,
  brandColor: string | null,
];

export interface IconCorpusManifest {
  version: string;
  total: number;
  chunkSize: number;
  chunks: number;
}

export interface IconCorpusChunk {
  version: string;
  chunk: number;
  rows: IconCorpusRow[];
}

/** Parse a raw JSON tags string, tolerating malformed values. */
export function parseRawTags(rawTags: string | null): string[] {
  if (!rawTags) return [];
  try {
    const parsed: unknown = JSON.parse(rawTags);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [];
  } catch {
    return [];
  }
}

/** Decode a corpus row into the `IconData` shape returned by the text search API. */
export function decodeIconCorpusRow(row: IconCorpusRow): IconData {
  const [id, name, normalizedName, sourceId, category, rawTags, viewBox, content, flags, strokeWidth, brandColor] = row;
  return {
    id,
    name,
    normalizedName,
    sourceId,
    category,
    tags: parseRawTags(rawTags),
    viewBox,
    content,
    pathData: null,
    defaultStroke: (flags & ICON_CORPUS_FLAGS.defaultStroke) !== 0,
    defaultFill: (flags & ICON_CORPUS_FLAGS.defaultFill) !== 0,
    strokeWidth,
    brandColor,
  };
}

/** Narrow an unknown JSON value to a corpus manifest. */
export function isIconCorpusManifest(value: unknown): value is IconCorpusManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "string" &&
    Number.isSafeInteger(candidate.total) &&
    Number.isSafeInteger(candidate.chunkSize) &&
    Number.isSafeInteger(candidate.chunks)
  );
}

/** Narrow an unknown JSON value to a corpus chunk. */
export function isIconCorpusChunk(value: unknown): value is IconCorpusChunk {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "string" &&
    Number.isSafeInteger(candidate.chunk) &&
    Array.isArray(candidate.rows)
  );
}
