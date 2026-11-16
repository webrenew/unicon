import { NextRequest, NextResponse } from "next/server";
import { getMemoizedIconCorpusChunkBody, getMemoizedIconCorpusManifest } from "@/lib/icon-corpus-server";
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
 * - With `chunk=N`: returns chunk N. Clients add `v=<version>` to the URL so a
 *   new extraction gets new cache keys; the server ignores `v` itself.
 *
 * Responses are CDN-cached and memoized per warm instance.
 */

const MANIFEST_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=86400";
const CHUNK_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit(getTrustedClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  const chunkParam = new URL(request.url).searchParams.get("chunk");

  try {
    const manifest = await getMemoizedIconCorpusManifest();

    if (chunkParam === null) {
      return NextResponse.json(manifest, {
        headers: { "Cache-Control": MANIFEST_CACHE_CONTROL },
      });
    }

    const chunk = /^\d+$/.test(chunkParam) ? Number.parseInt(chunkParam, 10) : Number.NaN;
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
    logger.error("Failed to serve icon corpus:", error);
    return NextResponse.json({ error: "Failed to load icon corpus" }, { status: 500 });
  }
}
