-- Proves the reviewed client-role access from #243 with real queries: what the
-- application does is allowed, cross-user access and everything else is
-- denied. The proof wraps this in a transaction and rolls it back. A failed
-- check raises an exception whose message names it.

-- Sign-up: the handle_new_user trigger still creates profiles.
insert into auth.users (id, email, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'grants-a@example.test', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'grants-b@example.test', 'authenticated', 'authenticated');

do $setup$
begin
  if (select count(*) from public.profiles where id in ('11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222')) <> 2 then
    raise exception 'access check failed: sign-up trigger did not create profiles';
  end if;
  insert into public.bundles (id, user_id, name, is_public, share_slug) values
    ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a private', false, null),
    ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'a public', true, 'grants-public'),
    ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'b private', false, null);
end $setup$;

set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
do $authenticated$
declare n int;
begin
  select count(*) into n from public.bundles where user_id = '11111111-1111-1111-1111-111111111111';
  if n <> 2 then raise exception 'access check failed: own bundles visible %', n; end if;
  select count(*) into n from public.bundles where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'access check failed: read another user''s private bundle'; end if;
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'access check failed: profiles visible %', n; end if;

  -- The PATCH route: allowed columns, own rows only. The updated_at trigger
  -- fires although this role has no EXECUTE on update_updated_at(): triggers
  -- are not checked for EXECUTE when they fire, so revoking it is safe for
  -- handle_new_user() too.
  if has_function_privilege('authenticated', 'public.update_updated_at()', 'EXECUTE') then
    raise exception 'access check failed: update_updated_at() is still executable';
  end if;
  update public.bundles set name = 'renamed', is_public = true, share_slug = public.generate_share_slug()
    where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'access check failed: own bundle update %', n; end if;
  update public.bundles set name = 'taken' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'access check failed: updated another user''s bundle'; end if;
  delete from public.bundles where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'access check failed: deleted another user''s bundle'; end if;

  begin
    update public.bundles set user_id = '22222222-2222-2222-2222-222222222222'
      where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    raise exception 'access check failed: bundles.user_id is writable';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.bundles set team_id = null where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    raise exception 'access check failed: bundles.team_id is writable';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.bundles (user_id, name) values ('11111111-1111-1111-1111-111111111111', 'direct');
    raise exception 'access check failed: direct bundle insert allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    truncate public.bundles;
    raise exception 'access check failed: bundles truncate allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set full_name = 'changed' where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'access check failed: profile update allowed';
  exception when insufficient_privilege then null;
  end;
  begin perform 1 from public.teams; raise exception 'access check failed: teams readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.team_members; raise exception 'access check failed: team_members readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.team_invites; raise exception 'access check failed: team_invites readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.api_sessions; raise exception 'access check failed: api_sessions readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.device_codes; raise exception 'access check failed: device_codes readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.subscriptions; raise exception 'access check failed: subscriptions readable';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.stripe_webhook_events; raise exception 'access check failed: stripe_webhook_events readable';
  exception when insufficient_privilege then null; end;
  begin perform public.check_device_code('grants'); raise exception 'access check failed: check_device_code callable';
  exception when insufficient_privilege then null; end;
  begin perform public.create_device_code('grants', 'read'); raise exception 'access check failed: create_device_code callable';
  exception when insufficient_privilege then null; end;
  begin perform public.accept_team_invite_atomic('grants', '11111111-1111-1111-1111-111111111111', 'grants-a@example.test');
    raise exception 'access check failed: accept_team_invite_atomic callable';
  exception when insufficient_privilege then null; end;

  delete from public.bundles where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'access check failed: own bundle delete %', n; end if;
end $authenticated$;

reset role;
set local role anon;
set local "request.jwt.claim.sub" = '';
do $anon$
declare n int;
begin
  -- Public bundle pages; bundle policies call get_user_team_ids()/is_team_admin().
  select count(*) into n from public.bundles where share_slug = 'grants-public' and is_public = true;
  if n <> 1 then raise exception 'access check failed: anon public bundle read %', n; end if;
  select count(*) into n from public.bundles where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  if n <> 0 then raise exception 'access check failed: anon read a private bundle'; end if;
  begin
    update public.bundles set name = 'anon' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
    raise exception 'access check failed: anon bundle update allowed';
  exception when insufficient_privilege then null;
  end;
  begin delete from public.bundles; raise exception 'access check failed: anon bundle delete allowed';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.profiles; raise exception 'access check failed: anon profiles readable';
  exception when insufficient_privilege then null; end;
  begin perform public.generate_share_slug(); raise exception 'access check failed: anon generate_share_slug callable';
  exception when insufficient_privilege then null; end;
  begin perform public.create_device_code('grants', 'read'); raise exception 'access check failed: anon create_device_code callable';
  exception when insufficient_privilege then null; end;
  begin perform public.check_device_code('grants'); raise exception 'access check failed: anon check_device_code callable';
  exception when insufficient_privilege then null; end;
  begin perform public.cleanup_expired_device_codes(); raise exception 'access check failed: anon cleanup_expired_device_codes callable';
  exception when insufficient_privilege then null; end;
end $anon$;

-- The server keeps its access, including the device flow.
reset role;
set local role service_role;
do $service$
begin
  perform 1 from public.api_sessions, public.teams, public.team_members, public.team_invites limit 1;
  perform public.create_device_code('grants', 'read');
  perform public.check_device_code('grants');
  perform public.generate_invite_token(), public.generate_team_slug('grants');
end $service$;
reset role;
