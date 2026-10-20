-- pgTAP integration suite; run against a disposable local Supabase database after all migrations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('51000000-0000-4000-8000-000000000001','authenticated','authenticated','pos-owner@example.invalid','',now(),'{}','{"display_name":"Owner"}',now(),now()),
('52000000-0000-4000-8000-000000000002','authenticated','authenticated','pos-member@example.invalid','',now(),'{}','{"display_name":"Member"}',now(),now()),
('53000000-0000-4000-8000-000000000003','authenticated','authenticated','pos-viewer@example.invalid','',now(),'{}','{"display_name":"Viewer"}',now(),now()),
('54000000-0000-4000-8000-000000000004','authenticated','authenticated','pos-outsider@example.invalid','',now(),'{}','{"display_name":"Outsider"}',now(),now()) on conflict(id) do nothing;
create temporary table pos_stab_ids as
select (select id from public.workspaces where owner_id='51000000-0000-4000-8000-000000000001' order by created_at desc limit 1) wa,
       (select id from public.workspaces where owner_id='54000000-0000-4000-8000-000000000004' order by created_at desc limit 1) wb;
insert into public.workspace_memberships(workspace_id,user_id,role) select wa,'52000000-0000-4000-8000-000000000002','member' from pos_stab_ids on conflict (workspace_id, user_id) do update set role='member';
insert into public.workspace_memberships(workspace_id,user_id,role) select wa,'53000000-0000-4000-8000-000000000003','viewer' from pos_stab_ids on conflict (workspace_id, user_id) do update set role='viewer';
insert into public.properties(workspace_id,name,address,property_type,unit_count) select wa,'Stable A','A Road','House',1 from pos_stab_ids on conflict do nothing;
insert into public.properties(workspace_id,name,address,property_type,unit_count) select wb,'Stable B','B Road','House',1 from pos_stab_ids on conflict do nothing;
create temporary table pos_stab_rows as select wa,wb,(select id from public.properties where name='Stable A' and workspace_id=wa limit 1) pa,(select id from public.properties where name='Stable B' and workspace_id=wb limit 1) pb from pos_stab_ids;
grant select on pos_stab_ids, pos_stab_rows to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','54000000-0000-4000-8000-000000000004',true);
select is((select count(*)::int from public.properties where name='Stable A'),0,'outsider cannot read another workspace');
select throws_ok($$insert into public.properties(workspace_id,name,address,property_type,unit_count) select wa,'Forged','No','House',1 from pos_stab_rows$$,'42501',NULL,'outsider cannot insert using forged workspace id');
select set_config('request.jwt.claim.sub','53000000-0000-4000-8000-000000000003',true);
select throws_ok($$insert into public.properties(workspace_id,name,address,property_type,unit_count) select wa,'Viewer insert','No','House',1 from pos_stab_rows$$,'42501',NULL,'viewer cannot insert');
update public.properties set name='Viewer update' where name='Stable A';
select is((select count(*)::int from public.properties where name='Stable A'),1,'viewer update is blocked by RLS');
delete from public.properties where name='Stable A';
select is((select count(*)::int from public.properties where name='Stable A'),1,'viewer delete is blocked by RLS');
select set_config('request.jwt.claim.sub','52000000-0000-4000-8000-000000000002',true);
delete from public.properties where name='Stable A';
select is((select count(*)::int from public.properties where name='Stable A'),1,'member delete is blocked by RLS');
select throws_ok($$insert into public.tenants(workspace_id,property_id,name,email,phone,unit_identifier,lease_start,lease_end,monthly_rent) select wa,pb,'Cross property','cross1@example.invalid','123','1','2026-01-01','2026-12-31',0 from pos_stab_rows$$,'23503',NULL,'cross-workspace property FK rejects forged relation');
insert into public.tenants(workspace_id,property_id,name,email,phone,unit_identifier,lease_start,lease_end,monthly_rent) select wa,pa,'Tenant A','tenantA@example.invalid','123','1','2026-01-01','2026-12-31',0 from pos_stab_rows;
select throws_ok($$insert into public.maintenance_requests(workspace_id,property_id,tenant_id,title,description) select wa,pb,(select id from public.tenants where email='tenantA@example.invalid'),'Bad link','wrong property' from pos_stab_rows$$,'23503',NULL,'tenant must belong to same property as maintenance request');
select throws_ok($$update public.properties set workspace_id=(select wb from pos_stab_rows) where name='Stable A'$$,'42501',NULL,'changing workspace id is rejected by RLS');
select set_config('request.jwt.claim.sub','51000000-0000-4000-8000-000000000001',true);
select throws_ok($$delete from public.properties where name='Stable A'$$,'23503',NULL,'property deletion blocked while tenant dependency exists');
select ok(public.workspace_has_role((select wa from pos_stab_rows),array['owner']),'owner role helper works without recursive RLS');
select ok(not public.workspace_has_role((select wb from pos_stab_rows),array['owner']),'role helper denies unrelated workspace');
reset role;
select * from finish();
rollback;
