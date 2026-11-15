-- Remove subscription entitlement checks while preserving authentication,
-- ownership, and the existing function ACLs.
CREATE OR REPLACE FUNCTION public.create_bundle_atomic(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_icons JSONB DEFAULT '[]'::JSONB,
  p_stroke_preset TEXT DEFAULT NULL,
  p_normalize_strokes BOOLEAN DEFAULT FALSE,
  p_target_stroke_width NUMERIC DEFAULT NULL,
  p_normalize_viewbox BOOLEAN DEFAULT FALSE,
  p_target_viewbox TEXT DEFAULT '0 0 24 24'
)
RETURNS TABLE (
  success BOOLEAN,
  bundle JSONB,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id UUID;
  v_bundle_count INTEGER;
  v_bundle public.bundles;
BEGIN
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Bundle owner must match the authenticated user' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Bundle owner must exist' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_bundle_count
  FROM public.bundles
  WHERE user_id = p_user_id;

  IF v_bundle_count >= 250 THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, 'Bundle limit reached (250 per account)'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.bundles (
    user_id, name, description, icons, stroke_preset,
    normalize_strokes, target_stroke_width, normalize_viewbox, target_viewbox
  )
  VALUES (
    p_user_id, p_name, p_description, p_icons, p_stroke_preset,
    p_normalize_strokes, p_target_stroke_width, p_normalize_viewbox, p_target_viewbox
  )
  RETURNING * INTO v_bundle;

  RETURN QUERY SELECT TRUE, to_jsonb(v_bundle), NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_bundle_atomic(uuid, text, text, jsonb, text, boolean, numeric, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_bundle_atomic(uuid, text, text, jsonb, text, boolean, numeric, boolean, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_create_bundle(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_bundle_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_bundle_count
  FROM public.bundles
  WHERE user_id = p_user_id;

  RETURN p_user_id IS NOT NULL AND v_bundle_count < 250;
END;
$$;

REVOKE ALL ON FUNCTION public.can_create_bundle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_bundle(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_bundle_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner_id UUID;
  v_bundle_count INTEGER;
BEGIN
  SELECT id INTO v_owner_id
  FROM public.profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Bundle owner must exist' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_bundle_count
  FROM public.bundles
  WHERE user_id = NEW.user_id;

  IF v_bundle_count >= 250 THEN
    RAISE EXCEPTION 'Bundle limit reached (250 per account)';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_bundle_limit() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_bundle_limit ON public.bundles;
CREATE TRIGGER enforce_bundle_limit
BEFORE INSERT ON public.bundles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_bundle_limit();

CREATE OR REPLACE FUNCTION public.create_api_token_direct(
  p_user_id UUID,
  p_name TEXT DEFAULT NULL,
  p_scope TEXT DEFAULT 'bundles:read'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_token TEXT;
  v_session_id UUID;
BEGIN
  v_token := public.generate_secure_token('uni_');

  INSERT INTO public.api_sessions (user_id, access_token, client_name, scope, name, expires_at)
  VALUES (p_user_id, v_token, 'Web', p_scope, p_name, NULL)
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'session_id', v_session_id,
    'access_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_api_token_direct(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_api_token_direct(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.authorize_device_code(p_user_code TEXT, p_user_id UUID)
RETURNS TABLE(success BOOLEAN, client_name TEXT, scope TEXT, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT dc.* INTO v_record
  FROM public.device_codes dc
  WHERE UPPER(REPLACE(dc.user_code, '-', '')) = UPPER(REPLACE(p_user_code, '-', ''))
    AND dc.status = 'pending'
    AND dc.expires_at > NOW();

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      FALSE,
      NULL::TEXT,
      NULL::TEXT,
      'Invalid or expired code'::TEXT;
    RETURN;
  END IF;

  UPDATE public.device_codes
  SET status = 'authorized',
      user_id = p_user_id,
      authorized_at = NOW()
  WHERE id = v_record.id;

  RETURN QUERY SELECT
    TRUE,
    v_record.client_name,
    v_record.scope,
    NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.authorize_device_code(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_device_code(text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_api_token(p_access_token TEXT)
RETURNS TABLE(valid BOOLEAN, user_id UUID, scope TEXT, is_pro BOOLEAN, error TEXT)
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
      NULL::BOOLEAN,
      'invalid_token'::TEXT;
    RETURN;
  END IF;

  UPDATE public.api_sessions
  SET last_used_at = NOW()
  WHERE id = v_session.id;

  -- Keep the legacy response shape during rollout. Entitlements no longer
  -- exist, so is_pro is always false. Remove the field after #258.
  RETURN QUERY SELECT
    TRUE,
    v_session.user_id,
    v_session.scope,
    FALSE,
    NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_api_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_token(text) TO service_role;
