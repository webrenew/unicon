-- Device Auth for MCP & CLI
-- Implements OAuth 2.0 Device Authorization Grant (RFC 8628)
-- Allows Pro users to authenticate CLI/MCP tools via browser login

-- =============================================================================
-- DEVICE CODES TABLE
-- Stores pending device authorization requests
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.device_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code TEXT NOT NULL UNIQUE,  -- Secret code for polling (CLI keeps this)
  user_code TEXT NOT NULL UNIQUE,    -- Short code user enters in browser
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- Set when user authorizes
  client_name TEXT NOT NULL DEFAULT 'CLI',  -- 'CLI' or 'MCP'
  scope TEXT NOT NULL DEFAULT 'bundles:read',  -- Permissions requested
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'denied', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  authorized_at TIMESTAMPTZ
);

-- Index for fast lookup by codes
CREATE INDEX idx_device_codes_device_code ON public.device_codes(device_code);
CREATE INDEX idx_device_codes_user_code ON public.device_codes(user_code);
CREATE INDEX idx_device_codes_expires_at ON public.device_codes(expires_at);

-- RLS for device_codes
ALTER TABLE public.device_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can view their own authorized device codes
CREATE POLICY "Users can view their authorized device codes" ON public.device_codes
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- API SESSIONS TABLE  
-- Long-lived sessions issued after device authorization
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.api_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,  -- Bearer token for API access (uni_xxx format)
  refresh_token TEXT UNIQUE,  -- Optional refresh token
  client_name TEXT NOT NULL DEFAULT 'CLI',  -- 'CLI' or 'MCP'
  scope TEXT NOT NULL DEFAULT 'bundles:read',
  device_code_id UUID REFERENCES public.device_codes(id) ON DELETE SET NULL,  -- Link to original device auth
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- NULL = no expiry
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookup
CREATE INDEX idx_api_sessions_access_token ON public.api_sessions(access_token);
CREATE INDEX idx_api_sessions_user_id ON public.api_sessions(user_id);
CREATE INDEX idx_api_sessions_refresh_token ON public.api_sessions(refresh_token) WHERE refresh_token IS NOT NULL;

-- RLS for api_sessions
ALTER TABLE public.api_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view their own sessions" ON public.api_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can revoke their own sessions
CREATE POLICY "Users can update their own sessions" ON public.api_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Generate a random alphanumeric string (for user codes)
CREATE OR REPLACE FUNCTION public.generate_user_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Removed confusing chars (0, O, 1, I)
  code TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  -- Format as XXXX-XXXX for readability
  RETURN substr(code, 1, 4) || '-' || substr(code, 5, 4);
END;
$$ LANGUAGE plpgsql;

-- Generate a secure random token (for device codes and access tokens)
CREATE OR REPLACE FUNCTION public.generate_secure_token(prefix TEXT DEFAULT '')
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  token TEXT := prefix;
  i INTEGER;
BEGIN
  FOR i IN 1..32 LOOP
    token := token || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Create a new device authorization request
CREATE OR REPLACE FUNCTION public.create_device_code(
  p_client_name TEXT DEFAULT 'CLI',
  p_scope TEXT DEFAULT 'bundles:read'
)
RETURNS TABLE (
  device_code TEXT,
  user_code TEXT,
  verification_uri TEXT,
  expires_in INTEGER
) AS $$
DECLARE
  v_device_code TEXT;
  v_user_code TEXT;
  v_id UUID;
  v_expires_in INTEGER := 900;  -- 15 minutes
BEGIN
  -- Generate unique codes with retry
  FOR i IN 1..5 LOOP
    v_device_code := public.generate_secure_token('dev_');
    v_user_code := public.generate_user_code();
    
    BEGIN
      INSERT INTO public.device_codes (device_code, user_code, client_name, scope, expires_at)
      VALUES (v_device_code, v_user_code, p_client_name, p_scope, NOW() + (v_expires_in || ' seconds')::INTERVAL)
      RETURNING id INTO v_id;
      
      EXIT;  -- Success, exit loop
    EXCEPTION WHEN unique_violation THEN
      IF i = 5 THEN RAISE; END IF;  -- Give up after 5 tries
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT 
    v_device_code,
    v_user_code,
    'https://unicon.sh/auth/device'::TEXT,
    v_expires_in;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check device code status (for polling)
CREATE OR REPLACE FUNCTION public.check_device_code(p_device_code TEXT)
RETURNS TABLE (
  status TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_in INTEGER,
  error TEXT
) AS $$
DECLARE
  v_record RECORD;
  v_access_token TEXT;
  v_refresh_token TEXT;
  v_session_id UUID;
BEGIN
  -- Look up the device code
  SELECT dc.* INTO v_record
  FROM public.device_codes dc
  WHERE dc.device_code = p_device_code;

  -- Not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'error'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::INTEGER,
      'invalid_grant'::TEXT;
    RETURN;
  END IF;

  -- Expired
  IF v_record.expires_at < NOW() THEN
    RETURN QUERY SELECT 
      'error'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::INTEGER,
      'expired_token'::TEXT;
    RETURN;
  END IF;

  -- Denied
  IF v_record.status = 'denied' THEN
    RETURN QUERY SELECT 
      'error'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::INTEGER,
      'access_denied'::TEXT;
    RETURN;
  END IF;

  -- Still pending
  IF v_record.status = 'pending' THEN
    RETURN QUERY SELECT 
      'pending'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      EXTRACT(EPOCH FROM (v_record.expires_at - NOW()))::INTEGER,
      'authorization_pending'::TEXT;
    RETURN;
  END IF;

  -- Authorized! Create session and return tokens
  IF v_record.status = 'authorized' THEN
    v_access_token := public.generate_secure_token('uni_');
    v_refresh_token := public.generate_secure_token('unr_');

    INSERT INTO public.api_sessions (
      user_id, 
      access_token, 
      refresh_token, 
      client_name, 
      scope,
      device_code_id
    )
    VALUES (
      v_record.user_id, 
      v_access_token, 
      v_refresh_token, 
      v_record.client_name, 
      v_record.scope,
      v_record.id
    )
    RETURNING id INTO v_session_id;

    -- Mark device code as used (can't be reused)
    UPDATE public.device_codes 
    SET status = 'expired' 
    WHERE id = v_record.id;

    RETURN QUERY SELECT 
      'authorized'::TEXT,
      v_access_token,
      v_refresh_token,
      NULL::INTEGER,
      NULL::TEXT;
    RETURN;
  END IF;

  -- Unknown state
  RETURN QUERY SELECT 
    'error'::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::INTEGER,
    'server_error'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Authorize a device code (called when user approves in browser)
CREATE OR REPLACE FUNCTION public.authorize_device_code(
  p_user_code TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  client_name TEXT,
  scope TEXT,
  error TEXT
) AS $$
DECLARE
  v_record RECORD;
  v_is_pro BOOLEAN;
BEGIN
  -- Check if user is Pro
  SELECT (s.plan = 'pro' AND s.status = 'active') INTO v_is_pro
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id;

  IF NOT v_is_pro THEN
    RETURN QUERY SELECT 
      FALSE,
      NULL::TEXT,
      NULL::TEXT,
      'API access requires a Pro subscription'::TEXT;
    RETURN;
  END IF;

  -- Look up the device code by user code (case insensitive, ignore dashes)
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

  -- Authorize the device code
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate an access token and return user info
CREATE OR REPLACE FUNCTION public.validate_api_token(p_access_token TEXT)
RETURNS TABLE (
  valid BOOLEAN,
  user_id UUID,
  scope TEXT,
  is_pro BOOLEAN,
  error TEXT
) AS $$
DECLARE
  v_session RECORD;
  v_is_pro BOOLEAN;
BEGIN
  -- Look up the session
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

  -- Check if user is still Pro
  SELECT (sub.plan = 'pro' AND sub.status = 'active') INTO v_is_pro
  FROM public.subscriptions sub
  WHERE sub.user_id = v_session.user_id;

  -- Update last used timestamp
  UPDATE public.api_sessions 
  SET last_used_at = NOW()
  WHERE id = v_session.id;

  RETURN QUERY SELECT 
    TRUE,
    v_session.user_id,
    v_session.scope,
    COALESCE(v_is_pro, FALSE),
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke a session
CREATE OR REPLACE FUNCTION public.revoke_api_session(p_session_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.api_sessions
  SET revoked_at = NOW()
  WHERE id = p_session_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired device codes (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_device_codes()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.device_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour'
    OR (status IN ('authorized', 'denied', 'expired') AND created_at < NOW() - INTERVAL '1 day');
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
