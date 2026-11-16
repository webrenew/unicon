/**
 * Server-side memoization for the icon corpus endpoint. Within a warm
 * instance, payloads are reused so CDN misses from different regions do not
 * query the database again.
 */
import { getIconCorpusChunk, getIconCorpusManifest } from "@/lib/queries";
import type { IconCorpusChunk, IconCorpusManifest } from "@/lib/icon-corpus-format";

const MANIFEST_TTL_MS = 5 * 60 * 1000;
/**
 * A fresh read is skipped if the memo is younger than this, so clients that
 * send unknown versions cannot force a database read on every request.
 */
const MIN_FRESH_READ_INTERVAL_MS = 10 * 1000;

let manifestMemo: { value: Promise<IconCorpusManifest>; readAt: number; expiresAt: number } | null = null;
const chunkMemo = new Map<string, Promise<string>>();

/** Thrown when the data changed and no longer matches the requested version. */
export class StaleIconCorpusError extends Error {
  constructor(readonly currentVersion: string) {
    super(`Icon corpus changed; current version is ${currentVersion}`);
    this.name = "StaleIconCorpusError";
  }
}

/** Drop the memoized manifest so the next call reads the database. */
function invalidateManifest(): void {
  manifestMemo = null;
}

/**
 * Get the corpus manifest, memoized for five minutes.
 *
 * @param options.fresh - Re-read the database, for example when a client
 *   reports a version this instance has not seen yet. Ignored while the memo
 *   is younger than `MIN_FRESH_READ_INTERVAL_MS`.
 */
export function getMemoizedIconCorpusManifest(
  options: { fresh?: boolean } = {}
): Promise<IconCorpusManifest> {
  const now = Date.now();
  if (manifestMemo && manifestMemo.expiresAt > now) {
    const canReadFresh = now - manifestMemo.readAt >= MIN_FRESH_READ_INTERVAL_MS;
    if (!options.fresh || !canReadFresh) return manifestMemo.value;
  }

  const value = getIconCorpusManifest();
  manifestMemo = { value, readAt: now, expiresAt: now + MANIFEST_TTL_MS };
  value.catch(() => {
    if (manifestMemo?.value === value) invalidateManifest();
  });
  return value;
}

/**
 * Get a serialized corpus chunk for `version`, memoized per version.
 *
 * The rows and their version come from one database snapshot. If that
 * version is not `version`, the data changed since the manifest was read:
 * the chunk is not cached and `StaleIconCorpusError` is thrown, so a chunk
 * from one extraction is never labeled with another extraction's version.
 */
export function getMemoizedIconCorpusChunkBody(version: string, chunk: number): Promise<string> {
  const key = `${version}:${chunk}`;
  const memoized = chunkMemo.get(key);
  if (memoized) return memoized;

  // Drop chunks from older versions before caching a new one.
  for (const existingKey of chunkMemo.keys()) {
    if (!existingKey.startsWith(`${version}:`)) chunkMemo.delete(existingKey);
  }

  const body = getIconCorpusChunk(chunk).then((snapshot) => {
    if (snapshot.version !== version) {
      invalidateManifest();
      throw new StaleIconCorpusError(snapshot.version);
    }
    return JSON.stringify({ version, chunk, rows: snapshot.rows } satisfies IconCorpusChunk);
  });
  chunkMemo.set(key, body);
  body.catch(() => {
    if (chunkMemo.get(key) === body) chunkMemo.delete(key);
  });
  return body;
}

/** Reset per-instance memoization (tests only). */
export function resetIconCorpusMemoForTests(): void {
  invalidateManifest();
  chunkMemo.clear();
}
