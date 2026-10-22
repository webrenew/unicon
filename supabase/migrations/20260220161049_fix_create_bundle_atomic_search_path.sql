-- Fix create_bundle_atomic: the 9-param overload uses bare table names
-- with search_path='', causing "relation subscriptions does not exist".
-- It also returns (bundle_id uuid) but the API expects (bundle jsonb).
--
-- Strategy:
--   1. DROP the broken 9-param overload
--   2. Recreate it with public-qualified table refs and correct return type
--   3. Also drop the stale 7-param overload (no callers)

-- Drop both overloads
DROP FUNCTION IF EXISTS public.create_bundle_atomic(uuid, text, text, jsonb, text, boolean, numeric, boolean, text);
DROP FUNCTION IF EXISTS public.create_bundle_atomic(uuid, text, text, jsonb, text, boolean, numeric);

-- Recreate the canonical 9-param version with fully-qualified table names
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_bundle_atomic(
  UUID, TEXT, TEXT, JSONB, TEXT, BOOLEAN, NUMERIC, BOOLEAN, TEXT
) TO authenticated;
