-- Run only against a disposable local Supabase DB with pgTAP:
-- supabase start && psql "$SUPABASE_DB_URL" -f supabase/tests/property_management_rls.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('30000000-0000-4000-8000-000000000003','authenticated','authenticated','pos-domain-a@example.invalid','',now(),'{}','{"display_name":"Domain A"}',now(),now()),
('40000000-0000-4000-8000-000000000004','authenticated','authenticated','pos-domain-b@example.invalid','',now(),'{}','{"display_name":"Domain B"}',now(),now())
on conflict(id) do nothing;
do $$ begin
 insert into public.properties(workspace_id,name,address,property_type,unit_count)
 select w.id,'A property','1 Main','House',1 from public.workspaces w where w.owner_id='30000000-0000-4000-8000-000000000003';
 insert into public.properties(workspace_id,name,address,property_type,unit_count)
 select w.id,'B property','2 Main','House',1 from public.workspaces w where w.owner_id='40000000-0000-4000-8000-000000000004';
end $$;
create temporary table pos_test_ids as
select wa.id as workspace_a, wb.id as workspace_b,
 (select id from public.properties where workspace_id=wa.id and name='A property') as property_a,
 (select id from public.properties where workspace_id=wb.id and name='B property') as property_b
from public.workspaces wa cross join public.workspaces wb
where wa.owner_id='30000000-0000-4000-8000-000000000003' and wb.owner_id='40000000-0000-4000-8000-000000000004';
grant select on pos_test_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.properties),1,'workspace A sees only own property');
select is((select count(*)::int from public.properties where name='B property'),0,'workspace A cannot read workspace B property');
select throws_ok($$insert into public.properties(workspace_id,name,address,property_type,unit_count) select workspace_b,'forged','No','House',1 from pos_test_ids$$,'42501',NULL,'workspace A cannot insert into workspace B');
select throws_ok($$insert into public.tenants(workspace_id,property_id,name,email,phone,unit_identifier,lease_start,lease_end,monthly_rent) select workspace_a,property_b,'Cross','cross@example.invalid','123','1','2026-01-01','2026-12-31',0 from pos_test_ids$$,'23503',NULL,'cross-workspace property foreign key rejected');
select throws_ok($$insert into public.maintenance_requests(workspace_id,property_id,title,description) select workspace_a,property_b,'Cross','bad relation' from pos_test_ids$$,'23503',NULL,'cross-workspace maintenance property rejected');
select is((select count(*)::int from public.tenants),0,'unauthorized tenant read is empty');
select is((select count(*)::int from public.maintenance_requests),0,'unauthorized maintenance read is empty');
reset role;
select * from finish();
rollback;
