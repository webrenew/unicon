
-- Fix 2 functions with mutable search_path
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT p.proname AS fname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proconfig IS NULL
      AND p.proname IN ('create_api_token_direct', 'list_api_sessions')
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = ''public''',
      func_record.fname, func_record.args);
  END LOOP;
END;
$$;

-- Add 3 missing FK indexes
CREATE INDEX idx_device_codes_user_id ON public.device_codes (user_id);
CREATE INDEX idx_api_sessions_device_code_id ON public.api_sessions (device_code_id);
CREATE INDEX idx_team_invites_invited_by ON public.team_invites (invited_by);
