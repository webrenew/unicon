-- #243: narrow the legacy client-role privileges that the October 30 grants
-- baseline preserved. service_role access is unchanged.
--
-- Decisions come from every call site in src/ (packages/cli and
-- packages/mcp-server only call the unicon.sh HTTP API):
--
--   bundles   anon SELECT: public bundle pages and GET /api/bundles/[id].
--             authenticated SELECT, DELETE and UPDATE of the columns the
--             PATCH route allows. Inserts go through create_bundle_atomic
--             (SECURITY DEFINER), so no client role inserts directly.
--   profiles  authenticated SELECT of the caller's own row (use-auth, getUser).
--   others    api_sessions, device_codes, stripe_webhook_events,
--             subscriptions, team_invites, team_members and teams are only
--             reached by the server (service_role) or by SECURITY DEFINER
--             functions, which run as their owner.
--
-- RLS still decides which rows a client role sees; these grants decide which
-- operations it may attempt at all. The existing client write policies on
-- api_sessions, profiles, teams, team_members and team_invites stay as a
-- second layer but are unreachable without a grant: they do not mean client
-- writes are validated, and re-granting one needs its own review. TRUNCATE, REFERENCES, TRIGGER and
-- MAINTAIN are not needed by any client role and TRUNCATE ignores RLS.

REVOKE ALL ON TABLE public.api_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.bundles FROM anon, authenticated;
REVOKE ALL ON TABLE public.device_codes FROM anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.stripe_webhook_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.subscriptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.team_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.team_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.teams FROM anon, authenticated;

GRANT SELECT ON TABLE public.bundles TO anon;
GRANT SELECT, DELETE ON TABLE public.bundles TO authenticated;
-- id, user_id, team_id, icon_count (generated) and the timestamps stay
-- read-only for clients; the updated_at trigger still sets updated_at.
GRANT UPDATE (name, description, icons, is_public, share_slug, stroke_preset,
  normalize_strokes, target_stroke_width, normalize_viewbox, target_viewbox)
  ON TABLE public.bundles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;

-- RPCs that only the server calls, or that only run inside SECURITY DEFINER
-- functions or as triggers. Calling them straight through the Data API skips
-- the server's authentication and rate limits (device codes mint API tokens).
-- Triggers fire without an EXECUTE check, so revoking it does not stop them.
REVOKE ALL ON FUNCTION public.accept_team_invite_atomic(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite_atomic(text, uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.check_device_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_device_code(text) TO service_role;
REVOKE ALL ON FUNCTION public.cleanup_expired_device_codes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_device_codes() TO service_role;
REVOKE ALL ON FUNCTION public.create_device_code(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_device_code(text, text) TO service_role;
REVOKE ALL ON FUNCTION public.generate_invite_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invite_token() TO service_role;
REVOKE ALL ON FUNCTION public.generate_secure_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_secure_token(text) TO service_role;
REVOKE ALL ON FUNCTION public.generate_team_slug(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_team_slug(text) TO service_role;
REVOKE ALL ON FUNCTION public.generate_user_code() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_user_code() TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at() TO service_role;

-- The bundles PATCH route calls this with the user's session; anon never does.
REVOKE ALL ON FUNCTION public.generate_share_slug() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_share_slug() TO authenticated, service_role;

-- get_user_team_ids() and is_team_admin(uuid) keep anon and authenticated
-- EXECUTE: bundles, teams and team_members policies call them for any role,
-- including anon reads of public bundles.
