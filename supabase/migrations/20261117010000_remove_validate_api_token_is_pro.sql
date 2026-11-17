-- #258: drop the legacy is_pro column from validate_api_token's result.
--
-- Entitlements were removed in 20261115190000_make_all_features_free.sql and
-- is_pro has returned FALSE since. Only the web server calls this RPC (it is
-- service_role-only), and the server never reads is_pro, so CLI and MCP
-- clients are unaffected. A changed result type needs DROP + CREATE; the
-- transaction keeps the function visible to other sessions until commit.

DROP FUNCTION public.validate_api_token(text);

CREATE FUNCTION public.validate_api_token(p_access_token TEXT)
RETURNS TABLE(valid BOOLEAN, user_id UUID, scope TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_session RECORD;
BEGIN
  SELECT s.* INTO v_session
  FROM public.api_sessions s
  WHERE s.access_token = p_access_token
    AND s.revoked_at IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::UUID,
      NULL::TEXT,
      'invalid_token'::TEXT;
    RETURN;
  END IF;

  UPDATE public.api_sessions
  SET last_used_at = NOW()
  WHERE id = v_session.id;

  RETURN QUERY SELECT
    TRUE,
    v_session.user_id,
    v_session.scope,
    NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_api_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_token(text) TO service_role;
