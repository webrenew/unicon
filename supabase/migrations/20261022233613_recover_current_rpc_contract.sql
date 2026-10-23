-- Recover RPC definitions and EXECUTE ACLs already present in production.
-- SQL was generated from the 2026-10-22 production catalog.
-- Definition-rendering hashes are pinned to PostgreSQL 17; review them on upgrade.
-- Every production definition matches its guard, so no production function is replaced.
-- Fresh historical replays recover the same restrictions and authorization behavior.
do $rpc_recovery$
begin
  if md5(pg_get_functiondef(to_regprocedure('public.validate_api_token(text)'))) is distinct from 'cb0db74839c1ca6bf47ddb1aa99b3a59' then
    raise notice 'Restoring public.validate_api_token from the reviewed PostgreSQL 17 catalog definition';
CREATE OR REPLACE FUNCTION public.validate_api_token(p_access_token text)
 RETURNS TABLE(valid boolean, user_id uuid, scope text, is_pro boolean, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- Check if user is Pro (for rate limit differentiation)
  SELECT (sub.plan = 'pro' AND sub.status = 'active') INTO v_is_pro
  FROM public.subscriptions sub
  WHERE sub.user_id = v_session.user_id;

  -- Update last used timestamp
  UPDATE public.api_sessions 
  SET last_used_at = NOW()
  WHERE id = v_session.id;

  -- Return valid for ALL authenticated users
  RETURN QUERY SELECT 
    TRUE,
    v_session.user_id,
    v_session.scope,
    COALESCE(v_is_pro, FALSE),
    NULL::TEXT;
END;
$function$
;
  end if;
end;
$rpc_recovery$;
do $rpc_recovery$
begin
  if md5(pg_get_functiondef(to_regprocedure('public.authorize_device_code(text,uuid)'))) is distinct from 'f1210bb9b8791d39197c0cad14ecc0b0' then
    raise notice 'Restoring public.authorize_device_code from the reviewed PostgreSQL 17 catalog definition';
CREATE OR REPLACE FUNCTION public.authorize_device_code(p_user_code text, p_user_id uuid)
 RETURNS TABLE(success boolean, client_name text, scope text, error text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_record RECORD;
BEGIN
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
$function$
;
  end if;
end;
$rpc_recovery$;
revoke all on function "public"."authorize_device_code"(p_user_code text, p_user_id uuid) from PUBLIC, anon, authenticated;
grant execute on function "public"."authorize_device_code"(p_user_code text, p_user_id uuid) to service_role;
revoke all on function "public"."can_create_bundle"(p_user_id uuid) from PUBLIC, anon, authenticated;
grant execute on function "public"."can_create_bundle"(p_user_id uuid) to service_role;
revoke all on function "public"."create_api_token_direct"(p_user_id uuid, p_name text, p_scope text) from PUBLIC, anon, authenticated;
grant execute on function "public"."create_api_token_direct"(p_user_id uuid, p_name text, p_scope text) to service_role;
revoke all on function "public"."get_user_bundle_count"(p_user_id uuid) from PUBLIC, anon, authenticated;
grant execute on function "public"."get_user_bundle_count"(p_user_id uuid) to service_role;
revoke all on function "public"."list_api_sessions"(p_user_id uuid) from PUBLIC, anon, authenticated;
grant execute on function "public"."list_api_sessions"(p_user_id uuid) to service_role;
revoke all on function "public"."revoke_api_session"(p_session_id uuid, p_user_id uuid) from PUBLIC, anon, authenticated;
grant execute on function "public"."revoke_api_session"(p_session_id uuid, p_user_id uuid) to service_role;
