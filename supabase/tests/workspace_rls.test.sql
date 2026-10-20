-- Optional database-level isolation test. Run against a disposable Supabase local database:
--   supabase start && psql "$SUPABASE_DB_URL" -f supabase/tests_workspace_rls.sql
-- This is an integration test, not a substitute for reviewing policies before production.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','pos-rls-a@example.invalid','',now(),'{}','{"display_name":"RLS A"}',now(),now()),
 ('20000000-0000-4000-8000-000000000002','authenticated','authenticated','pos-rls-b@example.invalid','',now(),'{}','{"display_name":"RLS B"}',now(),now())
on conflict (id) do nothing;

select is((select count(*)::int from public.workspaces where owner_id = '10000000-0000-4000-8000-000000000001'), 1, 'user A receives a personal workspace');
select is((select count(*)::int from public.workspace_memberships where user_id = '10000000-0000-4000-8000-000000000001' and role = 'owner'), 1, 'user A is owner of own workspace');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((select count(*)::int from public.workspaces where owner_id = '20000000-0000-4000-8000-000000000002'), 0, 'user A cannot read user B workspace by guessing its owner UUID');
select is((select count(*)::int from public.workspace_memberships where user_id = '20000000-0000-4000-8000-000000000002'), 0, 'user A cannot enumerate user B memberships');
reset role;
select * from finish();
rollback;
