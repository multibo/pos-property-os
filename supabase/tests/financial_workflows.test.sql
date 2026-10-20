-- Run after migrations 001-004 against a disposable local Supabase DB with pgTAP.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);
insert into auth.users (id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('61000000-0000-4000-8000-000000000001','authenticated','authenticated','fin-owner@example.invalid','',now(),'{}','{}',now(),now()),
('62000000-0000-4000-8000-000000000002','authenticated','authenticated','fin-viewer@example.invalid','',now(),'{}','{}',now(),now()),
('63000000-0000-4000-8000-000000000003','authenticated','authenticated','fin-outsider@example.invalid','',now(),'{}','{}',now(),now()) on conflict(id) do nothing;
create temporary table fin_ids as
select (select id from public.workspaces where owner_id='61000000-0000-4000-8000-000000000001' order by created_at desc limit 1) wa,
       (select id from public.workspaces where owner_id='63000000-0000-4000-8000-000000000003' order by created_at desc limit 1) wb;
insert into public.workspace_memberships(workspace_id,user_id,role) select wa,'62000000-0000-4000-8000-000000000002','viewer' from fin_ids on conflict do update set role='viewer';
insert into public.properties(workspace_id,name,address,property_type,unit_count) select wa,'Fin A','A','House',1 from fin_ids on conflict do nothing;
insert into public.properties(workspace_id,name,address,property_type,unit_count) select wb,'Fin B','B','House',1 from fin_ids on conflict do nothing;
insert into public.tenants(workspace_id,property_id,name,email,phone,unit_identifier,lease_start,lease_end,monthly_rent)
select wa,(select id from public.properties where workspace_id=wa and name='Fin A' limit 1),'Fin Tenant','fin-tenant@example.invalid','123','1','2026-01-01','2026-12-31',100.00 from fin_ids on conflict do nothing;
insert into public.tenants(workspace_id,property_id,name,email,phone,unit_identifier,lease_start,lease_end,monthly_rent)
select wb,(select id from public.properties where workspace_id=wb and name='Fin B' limit 1),'Other Tenant','other-tenant@example.invalid','123','1','2026-01-01','2026-12-31',100.00 from fin_ids on conflict do nothing;
create temporary table fin_fixture as select wa,wb,(select id from public.tenants where workspace_id=wa and email='fin-tenant@example.invalid' limit 1) tid,(select id from public.tenants where workspace_id=wb and email='other-tenant@example.invalid' limit 1) tb from fin_ids;
grant select on fin_ids,fin_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','63000000-0000-4000-8000-000000000003',true);
select is((select count(*)::int from public.payments where workspace_id=(select wa from fin_fixture)),0,'outsider cannot read financial records');
select throws_ok($$select public.create_rent_invoice(wa,tid,'forged','2026-01-01','2026-01-31','2026-02-01',10000,'manual') from fin_fixture$$,'42501','Not authorized to create invoices','outsider cannot create invoice by forging workspace id');
select set_config('request.jwt.claim.sub','62000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.create_rent_invoice(wa,tid,'viewer invoice','2026-01-01','2026-01-31','2026-02-01',10000,'manual') from fin_fixture$$,'42501','Not authorized to create invoices','viewer cannot create invoices');
select throws_ok($$select public.record_rent_payment(wa,tid,1000,now(),'Cash',null,null,'6a000000-0000-4000-8000-00000000000a','[]'::jsonb) from fin_fixture$$,'42501','Not authorized to record payments','viewer cannot record payments');
select throws_ok($$insert into public.payments(workspace_id,tenant_id,receipt_number,idempotency_key,amount_paise) select wa,tid,'FORGED','6b000000-0000-4000-8000-00000000000b',1000 from fin_fixture$$,'42501','permission denied for table payments','direct authenticated table writes cannot bypass financial RPCs');
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.create_rent_invoice(wa,tb,'cross workspace tenant','2026-01-01','2026-01-31','2026-02-01',10000,'manual') from fin_fixture$$,'23503','Tenant is not in the selected workspace','cross-workspace tenant cannot be linked to invoice');
select lives_ok($$select public.create_rent_invoice(wa,tid,'Jan rent','2026-01-01','2026-01-31','2026-02-01',10000,'rent_charge') from fin_fixture$$,'owner can create invoice through atomic RPC');
select is((select amount_paise from public.rent_invoices where description='Jan rent'),10000::bigint,'invoice stores integer paise');
-- Duplicate recurring charge period is prevented by a partial unique index.
select throws_ok($$select public.create_rent_invoice(wa,tid,'Duplicate Jan rent','2026-01-01','2026-01-31','2026-02-01',10000,'rent_charge') from fin_fixture$$,'23505','duplicate key value violates unique constraint "rent_invoice_period_once"','duplicate tenant billing period is rejected');
select lives_ok($$select public.record_rent_payment(wa,tid,4000,now(),'UPI','UPI-1',null,'64000000-0000-4000-8000-000000000004',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',4000))) from fin_fixture$$,'partial payment and allocation are atomic');
select is((select outstanding_paise from public.rent_invoice_balances where description='Jan rent'),6000::bigint,'partial allocation yields correct outstanding balance');
select throws_ok($$select public.record_rent_payment(wa,tid,8000,now(),'UPI','UPI-2',null,'65000000-0000-4000-8000-000000000005',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',7000))) from fin_fixture$$,'23514','Allocation exceeds invoice outstanding balance','allocation above remaining invoice balance is rejected');
select throws_ok($$select public.record_rent_payment(wa,tid,1000,now(),'UPI','UPI-3',null,'66000000-0000-4000-8000-000000000006',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000))) from fin_fixture$$,'23514','Allocations exceed payment amount','allocation above payment amount is rejected');
select lives_ok($$select public.create_rent_invoice(wa,tid,'Feb rent','2026-02-01','2026-02-28','2026-03-05',10000,'manual') from fin_fixture$$,'second invoice can be created');
select lives_ok($$select public.record_rent_payment(wa,tid,3000,now(),'UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'one payment can allocate to multiple invoices atomically');
select lives_ok($$select public.record_rent_payment(wa,tid,3000,now(),'UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'same idempotency key returns existing payment');
select throws_ok($$select public.record_rent_payment(wa,tid,3500,now(),'UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same idempotency key with changed amount is rejected');
select throws_ok($$select public.record_rent_payment(wa,tid,3000,now(),'Cash','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same idempotency key with changed method is rejected');
select throws_ok($$select public.record_rent_payment(wa,tid,3000,now(),'UPI','CHANGED-REF',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same key with changed reference is rejected');
select throws_ok($$select public.record_rent_payment(wa,tid,3000,now(),'UPI','MULTI','changed notes','67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same key with changed notes is rejected');
select throws_ok($$select public.record_rent_payment(wa,tid,3000,'2026-02-02 12:00:00+00','UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same key with changed received date is rejected');
select throws_ok($$select public.record_rent_payment(wa,tb,3000,now(),'UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same key with changed tenant is rejected');
select throws_ok($$select public.record_rent_payment(wa,tid,3000,now(),'UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2500),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',500))) from fin_fixture$$,'23505','Idempotency key was already used with different payment details','same key with changed allocations is rejected');
select is((select count(*)::int from public.payments where reference='MULTI'),1,'idempotent retry creates no duplicate payment');
-- Simulate a payment fingerprint written by migration 005 before the additive upgrade.
reset role;
update public.payments
   set request_fingerprint = ((request_fingerprint::jsonb - 'received_at_epoch') || jsonb_build_object('received_at', received_at))::text
 where reference='MULTI';
set local role authenticated;
select set_config('request.jwt.claim.sub','61000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.record_rent_payment(wa,tid,3000,now(),'UPI','MULTI',null,'67000000-0000-4000-8000-000000000007',jsonb_build_array(jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Jan rent' limit 1),'amount_paise',2000),jsonb_build_object('invoice_id',(select id from public.rent_invoices where description='Feb rent' limit 1),'amount_paise',1000))) from fin_fixture$$,'legacy fingerprint retry remains compatible after migration');
-- Timestamp fingerprints must be stable across client session time zones.
set local timezone = 'UTC';
select lives_ok($$select public.record_rent_payment(wa,tid,1200,'2026-04-05 12:30:00+00','Cash','TZ-RETRY',null,'6f000000-0000-4000-8000-00000000000f','[]'::jsonb) from fin_fixture$$,'fixed timestamp payment is accepted in UTC session');
set local timezone = 'America/Los_Angeles';
select lives_ok($$select public.record_rent_payment(wa,tid,1200,'2026-04-05 05:30:00-07','Cash','TZ-RETRY',null,'6f000000-0000-4000-8000-00000000000f','[]'::jsonb) from fin_fixture$$,'same instant retry succeeds in a different session time zone');
select is((select count(*)::int from public.payments where reference='TZ-RETRY'),1,'time-zone-independent retry creates one payment');
set local timezone = 'UTC';
select lives_ok($$select public.record_rent_payment(wa,tid,5000,now(),'Cash','UNAPPLIED',null,'68000000-0000-4000-8000-000000000008','[]'::jsonb) from fin_fixture$$,'unallocated receipt is accepted');
select is((select credit_paise from public.financial_ledger where reference=(select receipt_number from public.payments where reference='UNAPPLIED') and account_code='unapplied_receipts'),5000::bigint,'unallocated receipt is credited to unapplied receipts');
select throws_ok($$select public.record_rent_payment(wa,tid,9007199254740992,now(),'Cash','TOO-LARGE',null,'69000000-0000-4000-8000-000000000009','[]'::jsonb) from fin_fixture$$,'22023','Invalid payment fields','oversized paise amount is rejected');
select is((select outstanding_paise from public.rent_invoice_balances where description='Jan rent'),4000::bigint,'multiple payment allocations reconcile invoice outstanding');
select lives_ok($$select public.void_rent_payment(wa,(select id from public.payments where reference='UPI-1'), 'entered in error') from fin_fixture$$,'owner can void payment through audited reversal');
select lives_ok($$select public.void_rent_payment(wa,(select id from public.payments where reference='MULTI'), 'duplicate test reversal') from fin_fixture$$,'multi-allocation payment can be voided with reversal');
select is((select outstanding_paise from public.rent_invoice_balances where description='Jan rent'),10000::bigint,'voided payments restore invoice outstanding');
select is((select outstanding_paise from public.rent_invoice_balances where description='Feb rent'),10000::bigint,'void restores second invoice outstanding');
select is((select count(*)::int from public.financial_ledger where transaction_type='payment_void'),4,'void appends reversing ledger rows for both allocated payments');
select ok((select sum(debit_paise)=sum(credit_paise) from public.financial_ledger where workspace_id=(select wa from fin_fixture)),'ledger debits and credits balance');
reset role;
select * from finish();
rollback;
