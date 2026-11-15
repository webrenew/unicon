/**
 * GET /api/bundles/me/[id]
 * 
 * Get a specific bundle with full icon data for the authenticated user.
 * Used by MCP, CLI, and Figma plugin to fetch bundle contents.
 * 
 * Rate limit: 100 requests/minute per authenticated user
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBearerToken, validateApiToken } from "@/lib/auth/api-token";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import { getIconsByIds } from "@/lib/queries";
import {
  generateReactBundle,
  generateSvgBundle,
  generateJsonBundle,
} from "@/lib/icon-converters";
import { normalizeIcons } from "@/lib/icon-utils";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SUPPORTED_FORMATS = new Set(["react", "svg", "json"]);
type BundleCodeFormat = "react" | "svg" | "json";

function parseBundleCodeFormat(rawFormat: string | null): BundleCodeFormat | null {
  if (rawFormat === null || rawFormat === "") {
    return "react";
  }

  if (!SUPPORTED_FORMATS.has(rawFormat)) {
    return null;
  }

  return rawFormat as BundleCodeFormat;
}

function parseStrokeWidth(rawStrokeWidth: string | null): number | null {
  if (rawStrokeWidth === null || rawStrokeWidth.trim() === "") {
    return 2;
  }

  const parsed = Number.parseFloat(rawStrokeWidth);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed <= 0 || parsed > 10) {
    return null;
  }

  return parsed;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    
    // Extract and validate token
    const token = extractBearerToken(request);
    
    if (!token) {
      return NextResponse.json(
        { 
          error: "unauthorized", 
          message: "Missing Authorization header. Use 'unicon login' to authenticate." 
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const validation = await validateApiToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: "invalid_token", 
          message: validation.error === "invalid_token" 
            ? "Invalid or expired token. Use 'unicon login' to re-authenticate."
            : `Token validation failed: ${validation.error}` 
        },
        { status: 401, headers: CORS_HEADERS }
      );
    }

    const rateLimit = await checkRateLimit(validation.userId!);
    
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

    // Parse query params
    const url = new URL(request.url);
    const format = parseBundleCodeFormat(url.searchParams.get("format"));
    if (!format) {
      return NextResponse.json(
        { error: "invalid_format", message: "format must be one of: react, svg, json" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const includeCode = url.searchParams.get("code") !== "false";
    const strokeWidth = parseStrokeWidth(url.searchParams.get("strokeWidth"));
    if (strokeWidth === null) {
      return NextResponse.json(
        { error: "invalid_stroke_width", message: "strokeWidth must be greater than 0 and less than or equal to 10" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Fetch the bundle
    const supabase = createAdminClient();
    
    const { data: bundle, error } = await supabase
      .from("bundles")
      .select("*")
      .eq("id", id)
      .eq("user_id", validation.userId)
      .single();

    if (error || !bundle) {
      return NextResponse.json(
        { error: "not_found", message: "Bundle not found" },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Get icon IDs from the bundle
    const iconIds = (bundle.icons as Array<{ id: string }>)?.map(i => i.id) || [];

    if (iconIds.length === 0) {
      return NextResponse.json({
        bundle: {
          id: bundle.id,
          name: bundle.name,
          description: bundle.description,
          icon_count: 0,
          icons: [],
        },
        code: includeCode ? "// Empty bundle - no icons" : undefined,
      }, { headers: CORS_HEADERS });
    }

    // Fetch full icon data
    const icons = await getIconsByIds(iconIds);
    const effectiveStrokeWidth = bundle.target_stroke_width ?? strokeWidth;

    // Apply normalization if bundle has it configured
    const normalizedIcons = bundle.normalize_strokes
      ? normalizeIcons(icons, { 
          strokeWidth: effectiveStrokeWidth,
          skipFillIcons: true,
        })
      : icons;

    // Generate code if requested
    let code: string | undefined;
    if (includeCode) {
      switch (format) {
        case "react":
          code = generateReactBundle(normalizedIcons, { strokeWidth: effectiveStrokeWidth });
          break;
        case "svg":
          code = generateSvgBundle(normalizedIcons, { strokeWidth: effectiveStrokeWidth });
          break;
        case "json":
          code = generateJsonBundle(normalizedIcons);
          break;
      }
    }

    return NextResponse.json(
      {
        bundle: {
          id: bundle.id,
          name: bundle.name,
          description: bundle.description,
          icon_count: icons.length,
          stroke_preset: bundle.stroke_preset,
          normalize_strokes: bundle.normalize_strokes,
          target_stroke_width: bundle.target_stroke_width,
          icons: icons.map(icon => ({
            id: icon.id,
            name: icon.name,
            normalizedName: icon.normalizedName,
            source: icon.sourceId,
          })),
        },
        format,
        code,
      },
      {
        headers: { ...CORS_HEADERS, ...getRateLimitHeaders(rateLimit) },
      }
    );
  } catch (err) {
    logger.error("GET /api/bundles/me/[id] error:", err);
    return NextResponse.json(
      { error: "server_error", message: "Internal server error" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
