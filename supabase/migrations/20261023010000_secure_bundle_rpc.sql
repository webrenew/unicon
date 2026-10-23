-- Proposed authorization repair. Requires separate production approval.
-- Table grants and historical migrations remain unchanged.
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
  v_plan TEXT;
  v_bundle_count INTEGER;
  v_bundle public.bundles;
BEGIN
  -- Web sessions may create only their own bundles. The MCP server uses a
  -- verified AuthContext and a service-role client; JWT text alone must not
  -- grant that trusted server exception.
  IF current_setting('role', true) IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid()) THEN
    RAISE EXCEPTION 'Bundle owner must match the authenticated user' USING ERRCODE = '42501';
  END IF;

  -- Lock the subscription row to serialize bundle creation per user.
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Pro users bypass bundle count limits.
  IF v_plan = 'pro' THEN
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
    RETURN;
  END IF;

  -- Free users are limited to 3 bundles.
  SELECT COUNT(*)::INTEGER INTO v_bundle_count
  FROM public.bundles
  WHERE user_id = p_user_id;

  IF v_bundle_count >= 3 THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB,
      'Free plan limited to 3 saved bundles. Upgrade to Pro for unlimited.'::TEXT;
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

-- Token validation is called only by the trusted server-side admin client.
REVOKE ALL ON FUNCTION public.validate_api_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_token(text) TO service_role;
