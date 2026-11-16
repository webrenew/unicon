/**
 * Server-side memoization for the icon corpus endpoint. Within a warm
 * instance, payloads are reused so CDN misses from different regions do not
 * query the database again.
 */
import { getIconCorpusChunk, getIconCorpusManifest } from "@/lib/queries";
import type { IconCorpusChunk, IconCorpusManifest } from "@/lib/icon-corpus-format";

const MANIFEST_TTL_MS = 5 * 60 * 1000;

let manifestMemo: { value: Promise<IconCorpusManifest>; expiresAt: number } | null = null;
const chunkMemo = new Map<string, Promise<string>>();

/** Get the corpus manifest, memoized for five minutes. */
export function getMemoizedIconCorpusManifest(): Promise<IconCorpusManifest> {
  const now = Date.now();
  if (manifestMemo && manifestMemo.expiresAt > now) return manifestMemo.value;

  const value = getIconCorpusManifest();
  manifestMemo = { value, expiresAt: now + MANIFEST_TTL_MS };
  value.catch(() => {
    if (manifestMemo?.value === value) manifestMemo = null;
  });
  return value;
}

/** Get a serialized corpus chunk, memoized per version. */
export function getMemoizedIconCorpusChunkBody(version: string, chunk: number): Promise<string> {
  const key = `${version}:${chunk}`;
  const memoized = chunkMemo.get(key);
  if (memoized) return memoized;

  // Drop chunks from older versions before caching a new one.
  for (const existingKey of chunkMemo.keys()) {
    if (!existingKey.startsWith(`${version}:`)) chunkMemo.delete(existingKey);
  }

  const body = getIconCorpusChunk(chunk).then((rows) =>
    JSON.stringify({ version, chunk, rows } satisfies IconCorpusChunk)
  );
  chunkMemo.set(key, body);
  body.catch(() => {
    if (chunkMemo.get(key) === body) chunkMemo.delete(key);
  });
  return body;
}

/** Reset per-instance memoization (tests only). */
export function resetIconCorpusMemoForTests(): void {
  manifestMemo = null;
  chunkMemo.clear();
}
