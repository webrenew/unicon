/**
 * API Token Validation
 * 
 * Validates Bearer tokens from MCP/CLI requests and returns user info.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export interface TokenValidationResult {
  valid: boolean;
  userId?: string;
  scope?: string;
  error?: string;
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

/**
 * Validate an API access token
 */
export async function validateApiToken(token: string): Promise<TokenValidationResult> {
  if (!token) {
    return { valid: false, error: "missing_token" };
  }

  // Check token format (should start with uni_)
  if (!token.startsWith("uni_")) {
    return { valid: false, error: "invalid_token_format" };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("validate_api_token", {
    p_access_token: token,
  });

  if (error) {
    logger.error("Token validation error:", error);
    return { valid: false, error: "validation_error" };
  }

  const result = data?.[0];
  if (!result || !result.valid) {
    return { valid: false, error: result?.error || "invalid_token" };
  }

  return {
    valid: true,
    userId: result.user_id,
    scope: result.scope,
  };
}

/**
 * Middleware helper to validate API requests
 * Returns user info if valid, or throws an error response
 */
export async function requireApiAuth(request: Request): Promise<{
  userId: string;
  scope: string;
}> {
  const token = extractBearerToken(request);
  
  if (!token) {
    throw new Response(
      JSON.stringify({ 
        error: "unauthorized", 
        message: "Missing Authorization header. Use 'unicon login' to authenticate." 
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const result = await validateApiToken(token);

  if (!result.valid) {
    throw new Response(
      JSON.stringify({ 
        error: "invalid_token", 
        message: result.error === "invalid_token" 
          ? "Invalid or expired token. Use 'unicon login' to re-authenticate."
          : `Token validation failed: ${result.error}` 
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return {
    userId: result.userId!,
    scope: result.scope!,
  };
}
