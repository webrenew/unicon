-- Add abuse-control state for device authorization polling
-- and enforce RFC8628-style slow_down behavior.

ALTER TABLE public.device_codes
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_interval_seconds INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS poll_slowdown_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_codes_poll_interval_seconds_check'
      AND conrelid = 'public.device_codes'::regclass
  ) THEN
    ALTER TABLE public.device_codes
      ADD CONSTRAINT device_codes_poll_interval_seconds_check
      CHECK (poll_interval_seconds >= 5 AND poll_interval_seconds <= 60);
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.check_device_code(TEXT);

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
  v_now TIMESTAMPTZ := NOW();
  v_new_poll_interval INTEGER;
BEGIN
  -- Lock row so polling metadata updates are deterministic.
  SELECT dc.* INTO v_record
  FROM public.device_codes dc
  WHERE dc.device_code = p_device_code
  FOR UPDATE;

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
  IF v_record.expires_at < v_now THEN
    UPDATE public.device_codes
    SET status = 'expired'
    WHERE id = v_record.id
      AND status = 'pending';

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

  -- Already used/expired
  IF v_record.status = 'expired' THEN
    RETURN QUERY SELECT
      'error'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      NULL::INTEGER,
      'expired_token'::TEXT;
    RETURN;
  END IF;

  -- Still pending
  IF v_record.status = 'pending' THEN
    IF v_record.last_polled_at IS NOT NULL
      AND v_record.last_polled_at + make_interval(secs => COALESCE(v_record.poll_interval_seconds, 5)) > v_now THEN
      v_new_poll_interval := LEAST(COALESCE(v_record.poll_interval_seconds, 5) + 5, 60);

      UPDATE public.device_codes
      SET poll_interval_seconds = v_new_poll_interval,
          poll_slowdown_count = COALESCE(poll_slowdown_count, 0) + 1
      WHERE id = v_record.id;

      RETURN QUERY SELECT
        'error'::TEXT,
        NULL::TEXT,
        NULL::TEXT,
        GREATEST(EXTRACT(EPOCH FROM (v_record.expires_at - v_now))::INTEGER, 0),
        'slow_down'::TEXT;
      RETURN;
    END IF;

    UPDATE public.device_codes
    SET last_polled_at = v_now
    WHERE id = v_record.id;

    RETURN QUERY SELECT
      'pending'::TEXT,
      NULL::TEXT,
      NULL::TEXT,
      GREATEST(EXTRACT(EPOCH FROM (v_record.expires_at - v_now))::INTEGER, 0),
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

    UPDATE public.device_codes
    SET status = 'expired',
        last_polled_at = v_now
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
