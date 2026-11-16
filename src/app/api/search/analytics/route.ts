import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { logSearch } from "@/lib/analytics";
import { checkPublicRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { getTrustedClientIp } from "@/lib/request-ip";

/**
 * POST /api/search/analytics
 *
 * Records a text search that the browser answered from the local icon corpus.
 * Those searches never reach `/api/icons`, so this keeps `search_analytics`
 * populated. The browser sends one beacon per settled query, not one per
 * keystroke.
 */

const MAX_QUERY_LENGTH = 200;
const MAX_RESULT_COUNT = 1_000_000;
const MAX_RESPONSE_TIME_MS = 60_000;
const SOURCE_FILTER_PATTERN = /^[a-z0-9-]{1,40}$/;

interface LocalSearchEvent {
  query: string;
  sourceFilter: string | undefined;
  resultCount: number;
  responseTimeMs: number | undefined;
}

function isBoundedInteger(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max;
}

/** Validate an untrusted beacon payload. Returns `null` when it is malformed. */
function parseLocalSearchEvent(body: unknown): LocalSearchEvent | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  const query = typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query || query.length > MAX_QUERY_LENGTH) return null;

  const { sourceFilter, resultCount, responseTimeMs } = payload;
  if (sourceFilter !== undefined && (typeof sourceFilter !== "string" || !SOURCE_FILTER_PATTERN.test(sourceFilter))) {
    return null;
  }
  if (!isBoundedInteger(resultCount, MAX_RESULT_COUNT)) return null;
  if (responseTimeMs !== undefined && !isBoundedInteger(responseTimeMs, MAX_RESPONSE_TIME_MS)) return null;

  return { query, sourceFilter, resultCount, responseTimeMs };
}

export async function POST(request: NextRequest) {
  const rateLimit = await checkPublicRateLimit(getTrustedClientIp(request));
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = parseLocalSearchEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Invalid search event" }, { status: 400 });
  }

  // logSearch never rejects; it logs its own failures.
  waitUntil(logSearch({ ...event, searchType: "text", cacheHit: false }));

  return new NextResponse(null, { status: 204 });
}
