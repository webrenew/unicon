-- Security Lockdown: Revoke public access to SECURITY DEFINER RPCs
--
-- ROOT CAUSE: Several SECURITY DEFINER functions were callable by anon/authenticated
-- roles, allowing potential privilege escalation. These functions run with elevated
-- (postgres) privileges and must only be callable by service_role.
--
-- PROD STATUS: create_api_token_direct was already revoked on prod as a critical fix.
-- This migration codifies that change and adds additional safe functions.
--
-- EXCLUDED (client-called, would break auth):
--   - validate_api_token: called by server middleware but via anon key for token validation
--   - check_device_code: called by device token polling endpoint
--   - create_bundle_atomic: called via authenticated session from browser/MCP
-- These require app-code changes to use service_role before lockdown.
--
-- INCLUDED (server-only-safe, all use createAdminClient / service_role):
--   - create_api_token_direct: POST /api/auth/tokens (already revoked on prod)
--   - list_api_sessions: GET /api/auth/tokens, settings page (both use admin client)
--   - revoke_api_session: DELETE /api/auth/tokens/[sessionId] (uses admin client)
--   - authorize_device_code: POST /api/auth/device/authorize (uses adminSupabase)
--   - can_create_bundle: no app call sites, internal helper
--   - get_user_bundle_count: no app call sites, internal helper

DO $$
DECLARE
  fn regprocedure;
  names text[] := ARRAY[
    'create_api_token_direct',
    'list_api_sessions',
    'revoke_api_session',
    'authorize_device_code',
    'can_create_bundle',
    'get_user_bundle_count'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;', fn);
  END LOOP;
END $$;
