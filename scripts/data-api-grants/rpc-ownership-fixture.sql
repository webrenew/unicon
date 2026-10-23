-- Disposable database only. All users, subscriptions and bundles roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111','rpc-owner@example.invalid','{}'),
  ('22222222-2222-2222-2222-222222222222','rpc-other@example.invalid','{}');
update public.subscriptions set plan='pro'
  where user_id='22222222-2222-2222-2222-222222222222';

set local role anon;
do $$ begin
  if has_function_privilege('anon', 'public.create_bundle_atomic(uuid,text,text,jsonb,text,boolean,numeric,boolean,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.validate_api_token(text)', 'EXECUTE') then
    raise exception 'Anonymous EXECUTE must be revoked independently of the owner guard';
  end if;
  begin
    perform public.create_bundle_atomic('11111111-1111-1111-1111-111111111111','anonymous');
    raise exception 'Anonymous bundle creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.validate_api_token('uni_local_fixture_invalid');
    raise exception 'Anonymous token validation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role authenticated;
set local "request.jwt.claim.sub"='11111111-1111-1111-1111-111111111111';
-- A claim string alone cannot take the trusted service-role exception.
set local "request.jwt.claim.role"='service_role';
do $$ declare result record; begin
  begin
    perform public.create_bundle_atomic('22222222-2222-2222-2222-222222222222','cross-user');
    raise exception 'Cross-user bundle creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.create_bundle_atomic(null,'null-owner');
    raise exception 'NULL-owner bundle creation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
  for index in 1..3 loop
    select * into result from public.create_bundle_atomic(
      '11111111-1111-1111-1111-111111111111','self-' || index);
    if result.success is distinct from true
       or result.bundle->>'user_id' is distinct from '11111111-1111-1111-1111-111111111111' then
      raise exception 'Authenticated owner bundle creation failed';
    end if;
  end loop;
  select * into result from public.create_bundle_atomic(
    '11111111-1111-1111-1111-111111111111','over-quota');
  if result.success is distinct from false then raise exception 'Free quota no longer enforced'; end if;
  begin
    perform public.validate_api_token('uni_local_fixture_invalid');
    raise exception 'Authenticated token validation unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
set local "request.jwt.claim.sub"='';
do $$ begin
  begin
    perform public.create_bundle_atomic('11111111-1111-1111-1111-111111111111','missing-subject');
    raise exception 'Missing authenticated subject unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role service_role;
do $$ declare result record; begin
  select * into result from public.create_bundle_atomic(
    '22222222-2222-2222-2222-222222222222','trusted-mcp');
  if result.success is distinct from true
     or result.bundle->>'user_id' is distinct from '22222222-2222-2222-2222-222222222222' then
    raise exception 'Trusted MCP bundle creation failed';
  end if;
  select * into result from public.validate_api_token('uni_local_fixture_invalid');
  if result.valid is distinct from false then raise exception 'Token validation response changed'; end if;
end $$;
reset role;
rollback;
