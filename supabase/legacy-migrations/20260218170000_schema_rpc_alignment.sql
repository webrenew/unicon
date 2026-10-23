-- Align runtime schema + RPC usage with committed migrations
-- Covers:
-- - teams.logo_url column used by team logo API routes
-- - bundles viewBox normalization columns used by bundle create/update flows
-- - create_bundle_atomic signature used by web + MCP create bundle paths
-- - API token RPCs used by settings + token management routes

-- =============================================================================
-- SCHEMA ALIGNMENT
-- =============================================================================

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

ALTER TABLE public.bundles
  ADD COLUMN IF NOT EXISTS normalize_viewbox BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS target_viewbox TEXT;

ALTER TABLE public.api_sessions
  ADD COLUMN IF NOT EXISTS name TEXT;

-- =============================================================================
-- BUNDLE RPC ALIGNMENT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_bundle_atomic(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_icons JSONB DEFAULT '[]'::JSONB,
  p_stroke_preset TEXT DEFAULT NULL,
  p_normalize_strokes BOOLEAN DEFAULT FALSE,
  p_target_stroke_width NUMERIC(3,1) DEFAULT NULL,
  p_normalize_viewbox BOOLEAN DEFAULT FALSE,
  p_target_viewbox TEXT DEFAULT '0 0 24 24'
)
RETURNS TABLE (
  success BOOLEAN,
  bundle JSONB,
  error TEXT
) AS $$
DECLARE
  v_plan TEXT;
  v_bundle_count INTEGER;
  v_bundle public.bundles;
BEGIN
  -- Lock the subscription row to serialize bundle creation per user.
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Pro users bypass bundle count limits.
  IF v_plan = 'pro' THEN
    INSERT INTO public.bundles (
      user_id,
      name,
      description,
      icons,
      stroke_preset,
      normalize_strokes,
      target_stroke_width,
      normalize_viewbox,
      target_viewbox
    )
    VALUES (
      p_user_id,
      p_name,
      p_description,
      p_icons,
      p_stroke_preset,
      p_normalize_strokes,
      p_target_stroke_width,
      p_normalize_viewbox,
      p_target_viewbox
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
    RETURN QUERY SELECT FALSE, NULL::JSONB, 'Free plan limited to 3 saved bundles. Upgrade to Pro for unlimited.'::TEXT;
    RETURN;
  END IF;

  INSERT INTO public.bundles (
    user_id,
    name,
    description,
    icons,
    stroke_preset,
    normalize_strokes,
    target_stroke_width,
    normalize_viewbox,
    target_viewbox
  )
  VALUES (
    p_user_id,
    p_name,
    p_description,
    p_icons,
    p_stroke_preset,
    p_normalize_strokes,
    p_target_stroke_width,
    p_normalize_viewbox,
    p_target_viewbox
  )
  RETURNING * INTO v_bundle;

  RETURN QUERY SELECT TRUE, to_jsonb(v_bundle), NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_bundle_atomic(
  UUID,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  BOOLEAN,
  NUMERIC,
  BOOLEAN,
  TEXT
) TO authenticated;

-- =============================================================================
-- API TOKEN RPCS (settings + token management)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.list_api_sessions(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  client_name TEXT,
  scope TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  token_preview TEXT
) AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.client_name,
    s.scope,
    s.last_used_at,
    s.created_at,
    CASE
      WHEN length(s.access_token) > 4 THEN 'uni_****' || right(s.access_token, 4)
      ELSE 'uni_****'
    END AS token_preview
  FROM public.api_sessions s
  WHERE s.user_id = p_user_id
    AND s.revoked_at IS NULL
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_api_token_direct(
  p_user_id UUID,
  p_name TEXT DEFAULT NULL,
  p_scope TEXT DEFAULT 'bundles:read'
)
RETURNS JSONB AS $$
DECLARE
  v_is_pro BOOLEAN;
  v_access_token TEXT;
  v_refresh_token TEXT;
  v_session_id UUID;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

  SELECT (s.plan = 'pro' AND s.status = 'active') INTO v_is_pro
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id;

  IF NOT COALESCE(v_is_pro, FALSE) THEN
    RETURN jsonb_build_object('error', 'pro_required');
  END IF;

  -- Token collisions are extremely unlikely but retried defensively.
  FOR i IN 1..5 LOOP
    BEGIN
      v_access_token := public.generate_secure_token('uni_');
      v_refresh_token := public.generate_secure_token('unr_');

      INSERT INTO public.api_sessions (
        user_id,
        name,
        access_token,
        refresh_token,
        client_name,
        scope
      )
      VALUES (
        p_user_id,
        NULLIF(trim(p_name), ''),
        v_access_token,
        v_refresh_token,
        'Web',
        COALESCE(NULLIF(trim(p_scope), ''), 'bundles:read')
      )
      RETURNING id INTO v_session_id;

      RETURN jsonb_build_object(
        'session_id', v_session_id,
        'access_token', v_access_token
      );
    EXCEPTION
      WHEN unique_violation THEN
        IF i = 5 THEN
          RETURN jsonb_build_object('error', 'token_generation_failed');
        END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('error', 'token_generation_failed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

