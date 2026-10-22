-- Add optional name column for user-labeled tokens
ALTER TABLE public.api_sessions
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Create API token directly (settings page, Pro users only)
CREATE OR REPLACE FUNCTION public.create_api_token_direct(
  p_user_id UUID,
  p_name TEXT DEFAULT NULL,
  p_scope TEXT DEFAULT 'bundles:read'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan TEXT;
  v_status TEXT;
  v_token TEXT;
  v_session_id UUID;
BEGIN
  SELECT plan, status INTO v_plan, v_status
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF v_plan IS NULL OR v_plan != 'pro' OR v_status != 'active' THEN
    RETURN jsonb_build_object('error', 'Pro subscription required');
  END IF;

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

-- List active API sessions for a user (settings page)
CREATE OR REPLACE FUNCTION public.list_api_sessions(p_user_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  client_name TEXT,
  scope TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  token_preview TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.client_name,
    s.scope,
    s.last_used_at,
    s.created_at,
    'uni_****' || RIGHT(s.access_token, 4) AS token_preview
  FROM public.api_sessions s
  WHERE s.user_id = p_user_id
    AND s.revoked_at IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
  ORDER BY s.created_at DESC;
END;
$$;
