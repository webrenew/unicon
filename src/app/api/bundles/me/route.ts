/**
 * GET /api/bundles/me
 * 
 * List all bundles for the authenticated user (via API token).
 * Used by MCP, CLI, and Figma plugin to fetch user's saved bundles.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApiAuth } from "@/lib/auth/api-token";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

/** Handle CORS preflight */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  try {
    let authContext;
    try {
      authContext = await requireApiAuth(request);
    } catch (error) {
      if (error instanceof Response) {
        return await responseWithCors(error);
      }
      throw error;
    }

    const rateLimit = await checkRateLimit(authContext.userId);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { 
          error: "rate_limit_exceeded", 
          message: "Rate limit exceeded. Please wait before making more requests."
        },
        { 
          status: 429,
          headers: { ...CORS_HEADERS, ...getRateLimitHeaders(rateLimit) },
        }
      );
    }

    // Fetch user's bundles using admin client
    const supabase = createAdminClient();
    
    const { data: bundles, error } = await supabase
      .from("bundles")
      .select("id, name, description, icon_count, is_public, share_slug, created_at, updated_at")
      .eq("user_id", authContext.userId)
      .order("updated_at", { ascending: false });

    if (error) {
      logger.error("Bundles fetch error:", error);
      return NextResponse.json(
        { error: "server_error", message: "Failed to fetch bundles" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        bundles: bundles || [],
        total: bundles?.length || 0,
      },
      {
        headers: {
          ...CORS_HEADERS,
          ...getRateLimitHeaders(rateLimit),
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
          "Vary": "Authorization",
        },
      }
    );
  } catch (err) {
    logger.error("GET /api/bundles/me error:", err);
    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

async function responseWithCors(response: Response): Promise<NextResponse> {
  let payload: unknown = { error: "Unauthorized" };
  try {
    payload = await response.json();
  } catch {
    // Fall back to default payload for non-JSON responses.
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: CORS_HEADERS,
  });
}
