-- Add viewBox normalization columns to bundles table
ALTER TABLE bundles 
ADD COLUMN normalize_viewbox boolean DEFAULT false,
ADD COLUMN target_viewbox text DEFAULT '0 0 24 24';

-- Update the create_bundle_atomic function to accept new parameters
CREATE OR REPLACE FUNCTION create_bundle_atomic(
  p_user_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_icons jsonb DEFAULT '[]'::jsonb,
  p_stroke_preset text DEFAULT NULL,
  p_normalize_strokes boolean DEFAULT false,
  p_target_stroke_width numeric DEFAULT NULL,
  p_normalize_viewbox boolean DEFAULT false,
  p_target_viewbox text DEFAULT '0 0 24 24'
)
RETURNS TABLE(success boolean, bundle_id uuid, error text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bundle_limit int;
  v_current_count int;
  v_new_bundle_id uuid;
BEGIN
  -- Get user's bundle limit based on subscription
  SELECT CASE WHEN s.plan = 'pro' THEN 100 ELSE 3 END
  INTO v_bundle_limit
  FROM subscriptions s
  WHERE s.user_id = p_user_id;

  -- Default to free tier if no subscription found
  IF v_bundle_limit IS NULL THEN
    v_bundle_limit := 3;
  END IF;

  -- Count existing bundles
  SELECT COUNT(*)
  INTO v_current_count
  FROM bundles b
  WHERE b.user_id = p_user_id;

  -- Check if limit would be exceeded
  IF v_current_count >= v_bundle_limit THEN
    RETURN QUERY SELECT false, NULL::uuid, 'Bundle limit reached. Upgrade to Pro for more bundles.'::text;
    RETURN;
  END IF;

  -- Create the bundle
  INSERT INTO bundles (
    user_id,
    name,
    description,
    icons,
    stroke_preset,
    normalize_strokes,
    target_stroke_width,
    normalize_viewbox,
    target_viewbox
  ) VALUES (
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
  RETURNING id INTO v_new_bundle_id;

  RETURN QUERY SELECT true, v_new_bundle_id, NULL::text;
END;
$$;
