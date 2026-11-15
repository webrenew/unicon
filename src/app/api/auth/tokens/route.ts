import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/rate-limit";

/**
 * GET /api/auth/tokens — List active API tokens for the current user
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_api_sessions", {
    p_user_id: user.id,
  });

  if (error) {
    logger.error("list_api_sessions error:", error);
    return NextResponse.json({ error: "Failed to list tokens" }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}

/**
 * POST /api/auth/tokens — Generate a new API token
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id);
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", message: "Rate limit exceeded. Please wait before creating more tokens." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — name is optional
  }

  const name = typeof body.name === "string" ? body.name.trim() || null : null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_api_token_direct", {
    p_user_id: user.id,
    p_name: name,
    p_scope: "bundles:read",
  });

  if (error) {
    logger.error("create_api_token_direct error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }

  const result = data as unknown as Record<string, unknown>;

  return NextResponse.json(
    {
      session_id: result.session_id,
      access_token: result.access_token,
    },
    { status: 201 }
  );
}
