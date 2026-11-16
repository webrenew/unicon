/**
 * Browser-side loader for the icon corpus (`GET /api/icons/corpus`).
 *
 * Loaded once per page session, the first time someone interacts with search
 * or filters. After that, every search, filter change and page change is
 * answered in memory by `searchIconIndex`, with no network round trip.
 *
 * Failures are not retried within the session: callers keep using the
 * server search API, which returns the same results.
 */
import {
  decodeIconCorpusRow,
  isIconCorpusChunk,
  isIconCorpusManifest,
  type IconCorpusChunk,
  type IconCorpusManifest,
} from "./icon-corpus-format";
import { createIconSearchEntry, createIconSearchIndex, type IconSearchIndex } from "./icon-search";

const CORPUS_ENDPOINT = "/api/icons/corpus";

/** Connection types where a multi-megabyte background download is not worth it. */
const SLOW_CONNECTION_TYPES = new Set(["slow-2g", "2g"]);

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

let loadedCorpus: IconSearchIndex | null = null;
let corpusPromise: Promise<IconSearchIndex> | null = null;

/** The corpus index if it has finished loading, otherwise `null`. */
export function getLoadedIconCorpus(): IconSearchIndex | null {
  return loadedCorpus;
}

/** Whether this browser should download the corpus (respects Save-Data and slow connections). */
export function shouldLoadIconCorpus(): boolean {
  if (typeof window === "undefined" || typeof fetch !== "function") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && SLOW_CONNECTION_TYPES.has(connection.effectiveType)) return false;
  return true;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Icon corpus request failed (${response.status}): ${url}`);
  return response.json();
}

async function fetchCorpus(): Promise<IconSearchIndex> {
  const manifest = await fetchJson(CORPUS_ENDPOINT);
  if (!isIconCorpusManifest(manifest)) throw new Error("Invalid icon corpus manifest");

  const chunks = await Promise.all(
    Array.from({ length: manifest.chunks }, (_, chunk) => fetchChunk(manifest, chunk)),
  );

  const entries = [];
  for (const { rows } of chunks) {
    for (const row of rows) entries.push(createIconSearchEntry(decodeIconCorpusRow(row), row[5]));
  }
  if (entries.length !== manifest.total) {
    throw new Error(`Icon corpus is incomplete: expected ${manifest.total}, got ${entries.length}`);
  }
  return createIconSearchIndex(entries);
}

async function fetchChunk(manifest: IconCorpusManifest, chunk: number): Promise<IconCorpusChunk> {
  const params = new URLSearchParams({ chunk: String(chunk), v: manifest.version });
  const data = await fetchJson(`${CORPUS_ENDPOINT}?${params}`);
  if (!isIconCorpusChunk(data) || data.chunk !== chunk) throw new Error(`Invalid icon corpus chunk ${chunk}`);
  // A chunk from a different extraction would mix datasets; let the caller fall back.
  if (data.version !== manifest.version) throw new Error(`Icon corpus version changed during load`);
  return data;
}

/**
 * Load the icon corpus once. Concurrent and repeated calls share one request;
 * a failed load stays failed for the rest of the session.
 */
export function loadIconCorpus(): Promise<IconSearchIndex> {
  if (!corpusPromise) {
    corpusPromise = fetchCorpus().then((index) => {
      loadedCorpus = index;
      return index;
    });
  }
  return corpusPromise;
}

/** Reset module state (tests only). */
export function resetIconCorpusForTests(): void {
  loadedCorpus = null;
  corpusPromise = null;
}
