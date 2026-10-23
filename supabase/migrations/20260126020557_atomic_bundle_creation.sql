-- Atomic bundle creation with race condition prevention
-- This function uses row-level locking to prevent concurrent bundle creation
-- from exceeding the free tier limit

CREATE OR REPLACE FUNCTION public.create_bundle_atomic(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_icons JSONB DEFAULT '[]'::JSONB,
  p_stroke_preset TEXT DEFAULT NULL,
  p_normalize_strokes BOOLEAN DEFAULT FALSE,
  p_target_stroke_width NUMERIC(3,1) DEFAULT NULL
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
  -- Lock the subscription row to prevent concurrent bundle creation
  -- This serializes bundle creation per user
  SELECT plan INTO v_plan
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Pro users bypass limit check
  IF v_plan = 'pro' THEN
    INSERT INTO public.bundles (user_id, name, description, icons, stroke_preset, normalize_strokes, target_stroke_width)
    VALUES (p_user_id, p_name, p_description, p_icons, p_stroke_preset, p_normalize_strokes, p_target_stroke_width)
    RETURNING * INTO v_bundle;

    RETURN QUERY SELECT TRUE, to_jsonb(v_bundle), NULL::TEXT;
    RETURN;
  END IF;

  -- Check bundle count for free users
  SELECT COUNT(*)::INTEGER INTO v_bundle_count
  FROM public.bundles
  WHERE user_id = p_user_id;

  IF v_bundle_count >= 3 THEN
    RETURN QUERY SELECT FALSE, NULL::JSONB, 'Free plan limited to 3 saved bundles. Upgrade to Pro for unlimited.'::TEXT;
    RETURN;
  END IF;

  -- Insert the bundle
  INSERT INTO public.bundles (user_id, name, description, icons, stroke_preset, normalize_strokes, target_stroke_width)
  VALUES (p_user_id, p_name, p_description, p_icons, p_stroke_preset, p_normalize_strokes, p_target_stroke_width)
  RETURNING * INTO v_bundle;

  RETURN QUERY SELECT TRUE, to_jsonb(v_bundle), NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_bundle_atomic TO authenticated;
