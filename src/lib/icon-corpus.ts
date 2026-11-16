/**
 * Browser-side loader for the icon corpus (`GET /api/icons/corpus`).
 *
 * Loaded the first time someone interacts with search or filters. After that, every search, filter change and page change is
 * answered in memory by `searchIconIndex`, with no network round trip.
 *
 * After a failure, callers keep using the server search API (same results)
 * and may retry once `RETRY_COOLDOWN_MS` has passed. Chunks that downloaded
 * before the failure come from the browser HTTP cache on retry.
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

/** Wait this long after a failed load before allowing another attempt. */
export const RETRY_COOLDOWN_MS = 60_000;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

let loadedCorpus: IconSearchIndex | null = null;
let corpusPromise: Promise<IconSearchIndex> | null = null;
let lastFailureAt: number | null = null;

/** The corpus index if it has finished loading, otherwise `null`. */
export function getLoadedIconCorpus(): IconSearchIndex | null {
  return loadedCorpus;
}

/**
 * Whether to start a corpus download now: respects Save-Data, slow
 * connections, and the cooldown after a failed load.
 */
export function shouldLoadIconCorpus(): boolean {
  if (typeof window === "undefined" || typeof fetch !== "function") return false;
  if (lastFailureAt !== null && Date.now() - lastFailureAt < RETRY_COOLDOWN_MS) return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (connection?.saveData) return false;
  if (connection?.effectiveType && SLOW_CONNECTION_TYPES.has(connection.effectiveType)) return false;
  return true;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (response.status === 409) throw new IconCorpusVersionChangedError();
  if (!response.ok) throw new Error(`Icon corpus request failed (${response.status}): ${url}`);
  return response.json();
}

/** The corpus changed since the manifest was read (server `409` or mismatched chunk). */
class IconCorpusVersionChangedError extends Error {
  constructor() {
    super("Icon corpus version changed during load");
    this.name = "IconCorpusVersionChangedError";
  }
}

/**
 * Fetch the corpus. If the version changes mid-load (for example a browser
 * still holding the old manifest after a re-extraction), re-read the manifest
 * once and fetch again rather than failing into the retry cooldown.
 */
async function fetchCorpus(revalidateManifest: boolean): Promise<IconSearchIndex> {
  try {
    return await fetchCorpusOnce(revalidateManifest);
  } catch (error) {
    if (!(error instanceof IconCorpusVersionChangedError) || revalidateManifest) throw error;
    return fetchCorpusOnce(true);
  }
}

async function fetchCorpusOnce(revalidateManifest: boolean): Promise<IconSearchIndex> {
  // Revalidating bypasses the browser's cached manifest (max-age=300), which
  // would otherwise still point at the old version.
  const manifest = await fetchJson(CORPUS_ENDPOINT, revalidateManifest ? { cache: "no-cache" } : undefined);
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
  // A chunk from a different extraction would mix datasets.
  if (data.version !== manifest.version) throw new IconCorpusVersionChangedError();
  return data;
}

/**
 * Load the icon corpus. Concurrent calls share one request and a successful
 * load is reused for the session. A failed load is forgotten, so a later call
 * (after `shouldLoadIconCorpus()` allows it) starts a new attempt.
 */
export function loadIconCorpus(): Promise<IconSearchIndex> {
  if (!corpusPromise) {
    // After a failure, start from a revalidated manifest.
    const attempt = fetchCorpus(lastFailureAt !== null).then(
      (index) => {
        loadedCorpus = index;
        lastFailureAt = null;
        return index;
      },
      (error: unknown) => {
        if (corpusPromise === attempt) corpusPromise = null;
        lastFailureAt = Date.now();
        throw error;
      },
    );
    corpusPromise = attempt;
  }
  return corpusPromise;
}

/** Reset module state (tests only). */
export function resetIconCorpusForTests(): void {
  loadedCorpus = null;
  corpusPromise = null;
  lastFailureAt = null;
}
