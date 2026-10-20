-- Disposable local Supabase + pgTAP integration test.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('60000000-0000-4000-8000-000000000006','authenticated','authenticated','pos-role-owner@example.invalid','',now(),'{}','{}',now(),now()), ('50000000-0000-4000-8000-000000000005','authenticated','authenticated','pos-viewer@example.invalid','',now(),'{}','{}',now(),now())
on conflict(id) do nothing;
create temporary table role_fixture as
select w.id workspace_id, null::uuid property_id
from public.workspaces w where w.owner_id='60000000-0000-4000-8000-000000000006';
insert into public.properties(workspace_id,name,address,property_type,unit_count) select workspace_id,'Role fixture','1 Main','House',1 from role_fixture;
update role_fixture set property_id=(select id from public.properties where workspace_id=role_fixture.workspace_id and name='Role fixture');
insert into public.workspace_memberships(workspace_id,user_id,role)
select workspace_id,'50000000-0000-4000-8000-000000000005','viewer' from role_fixture
on conflict(workspace_id,user_id) do update set role='viewer';
grant select on role_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000005',true);
select is((select count(*)::int from public.properties),1,'viewer can read workspace records');
select throws_ok($$insert into public.properties(workspace_id,name,address,property_type,unit_count) select workspace_id,'Viewer write','No','House',1 from role_fixture$$,'42501',NULL,'viewer cannot create records');
delete from public.properties where id=(select property_id from role_fixture);
  select is((select count(*)::int from public.properties where id=(select property_id from role_fixture)),1,'viewer cannot delete records');
reset role;
select * from finish();
rollback;
