import { NextRequest, NextResponse } from "next/server";
import {
  StaleIconCorpusError,
  getMemoizedIconCorpusChunkBody,
  getMemoizedIconCorpusManifest,
} from "@/lib/icon-corpus-server";
import { logger } from "@/lib/logger";
import { checkPublicRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-ip";

/**
 * GET /api/icons/corpus
 *
 * Serves the full icon corpus so the browser can search locally, with no
 * network round trip per keystroke.
 *
 * - Without `chunk`: returns the manifest (version and chunk layout).
 * - With `chunk=N&v=<version>`: returns chunk N. The version gives each
 *   extraction its own cache keys. When `v` is not the current version, or the
 *   data changes mid-request, the response is `409` with `no-store`, so a
 *   chunk from one extraction is never cached under another's version.
 *
 * Responses are CDN-cached and memoized per warm instance.
 */

const MANIFEST_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
const CHUNK_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const CHUNK_PARAM_PATTERN = /^\d+$/;

function staleVersionResponse(currentVersion: string) {
  return NextResponse.json(
    { error: "Icon corpus version changed", version: currentVersion },
    { status: 409, headers: { "Cache-Control": "no-store" } }
  );
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit(getTrustedClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  const { searchParams } = new URL(request.url);
  const chunkParam = searchParams.get("chunk");
  const requestedVersion = searchParams.get("v");

  try {
    let manifest = await getMemoizedIconCorpusManifest();

    if (chunkParam === null) {
      return NextResponse.json(manifest, {
        headers: { "Cache-Control": MANIFEST_CACHE_CONTROL },
      });
    }

    // This instance's memoized manifest may be older than the client's.
    if (requestedVersion !== null && requestedVersion !== manifest.version) {
      manifest = await getMemoizedIconCorpusManifest({ fresh: true });
      if (requestedVersion !== manifest.version) return staleVersionResponse(manifest.version);
    }

    const chunk = CHUNK_PARAM_PATTERN.test(chunkParam) ? Number.parseInt(chunkParam, 10) : Number.NaN;
    if (!Number.isSafeInteger(chunk) || chunk >= manifest.chunks) {
      return NextResponse.json({ error: "Invalid chunk" }, { status: 400 });
    }

    const body = await getMemoizedIconCorpusChunkBody(manifest.version, chunk);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": CHUNK_CACHE_CONTROL,
      },
    });
  } catch (error) {
    if (error instanceof StaleIconCorpusError) return staleVersionResponse(error.currentVersion);
    logger.error("Failed to serve icon corpus:", error);
    return NextResponse.json({ error: "Failed to load icon corpus" }, { status: 500 });
  }
}
