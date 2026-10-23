
-- Fix security advisory: function_search_path_mutable
-- Set search_path to empty string to prevent search path injection.
-- All functions already use fully-qualified public.* references.

ALTER FUNCTION public.generate_user_code() SET search_path = '';
ALTER FUNCTION public.generate_secure_token(text) SET search_path = '';
ALTER FUNCTION public.generate_team_slug(text) SET search_path = '';
ALTER FUNCTION public.generate_invite_token() SET search_path = '';
ALTER FUNCTION public.generate_share_slug() SET search_path = '';
ALTER FUNCTION public.generate_user_code() SET search_path = '';
ALTER FUNCTION public.update_updated_at() SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.get_user_bundle_count(uuid) SET search_path = '';
ALTER FUNCTION public.can_create_bundle(uuid) SET search_path = '';

-- Device auth flow functions
ALTER FUNCTION public.create_device_code(text, text) SET search_path = '';
ALTER FUNCTION public.check_device_code(text) SET search_path = '';
ALTER FUNCTION public.authorize_device_code(text, uuid) SET search_path = '';

-- API session functions
ALTER FUNCTION public.validate_api_token(text) SET search_path = '';
ALTER FUNCTION public.revoke_api_session(uuid, uuid) SET search_path = '';
ALTER FUNCTION public.cleanup_expired_device_codes() SET search_path = '';

-- create_bundle_atomic has two overloads (different param counts)
ALTER FUNCTION public.create_bundle_atomic(uuid, text, text, jsonb, text, boolean, numeric) SET search_path = '';
ALTER FUNCTION public.create_bundle_atomic(uuid, text, text, jsonb, text, boolean, numeric, boolean, text) SET search_path = '';
