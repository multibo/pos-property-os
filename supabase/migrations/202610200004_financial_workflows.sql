begin;
-- Financial amounts are integer paise (INR minor units). Tenant monthly_rent remains numeric rupees
-- for backwards compatibility; finance UI converts rupees to paise at the form boundary only.
create table public.rent_invoices (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 tenant_id uuid not null, property_id uuid not null, invoice_number text not null, source text not null default 'manual' check(source in ('manual','rent_charge')),
 description text not null check(length(trim(description)) between 1 and 500), period_start date not null, period_end date not null,
 due_date date not null, amount_paise bigint not null check(amount_paise > 0 and amount_paise <= 9007199254740991), voided_at timestamptz, void_reason text,
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,tenant_id,id), unique(workspace_id,invoice_number),
 constraint rent_invoices_property_workspace_fk foreign key(workspace_id,property_id) references public.properties(workspace_id,id) on delete restrict,
 constraint rent_invoices_workspace_property_tenant_fk foreign key(workspace_id,property_id,tenant_id) references public.tenants(workspace_id,property_id,id) on delete restrict,
 check(period_end >= period_start), check((voided_at is null and void_reason is null) or (voided_at is not null and length(trim(coalesce(void_reason,''))) > 0))
);
create unique index rent_invoice_period_once on public.rent_invoices(workspace_id,tenant_id,period_start,period_end) where source='rent_charge' and voided_at is null;
create index rent_invoice_workspace_due_idx on public.rent_invoices(workspace_id,due_date) where voided_at is null;
create index rent_invoice_tenant_idx on public.rent_invoices(workspace_id,tenant_id,created_at desc);

create table public.payments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 tenant_id uuid not null, receipt_number text not null, idempotency_key uuid not null, amount_paise bigint not null check(amount_paise > 0 and amount_paise <= 9007199254740991),
 received_at timestamptz not null default now(), method text not null default 'Other' check(method in ('Cash','Bank transfer','Cheque','UPI','Other')),
 reference text, notes text, voided_at timestamptz, void_reason text, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,tenant_id,id), unique(workspace_id,receipt_number), unique(workspace_id,idempotency_key),
 constraint payments_tenant_workspace_fk foreign key(workspace_id,tenant_id) references public.tenants(workspace_id,id) on delete restrict,
 check((voided_at is null and void_reason is null) or (voided_at is not null and length(trim(coalesce(void_reason,''))) > 0))
);
create index payments_workspace_received_idx on public.payments(workspace_id,received_at desc);
create index payments_tenant_idx on public.payments(workspace_id,tenant_id,received_at desc);

create table public.payment_allocations (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 tenant_id uuid not null, payment_id uuid not null, invoice_id uuid not null, amount_paise bigint not null check(amount_paise > 0 and amount_paise <= 9007199254740991), created_at timestamptz not null default now(),
 constraint allocations_payment_tenant_fk foreign key(workspace_id,tenant_id,payment_id) references public.payments(workspace_id,tenant_id,id) on delete restrict,
 constraint allocations_invoice_tenant_fk foreign key(workspace_id,tenant_id,invoice_id) references public.rent_invoices(workspace_id,tenant_id,id) on delete restrict,
 unique(workspace_id,payment_id,invoice_id)
);
create index allocation_invoice_idx on public.payment_allocations(workspace_id,invoice_id);

-- Ledger convention: each event is represented by balanced debit/credit rows.
-- Invoice: Dr accounts_receivable / Cr rent_income. Payment: Dr cash / Cr accounts_receivable
-- for allocated amount and Cr unapplied_receipts for the unallocated remainder. Voids post exact reversals.
create table public.financial_ledger (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 transaction_id uuid not null, transaction_type text not null check(transaction_type in ('invoice','payment','payment_void','invoice_void')),
 account_code text not null check(account_code in ('accounts_receivable','rent_income','cash','unapplied_receipts')),
 transaction_date timestamptz not null default now(), description text not null, reference text,
 debit_paise bigint not null default 0 check(debit_paise >= 0 and debit_paise <= 9007199254740991), credit_paise bigint not null default 0 check(credit_paise >= 0 and credit_paise <= 9007199254740991),
 created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
 check((debit_paise > 0 and credit_paise = 0) or (credit_paise > 0 and debit_paise = 0)),
 unique(workspace_id,id)
);
create index ledger_workspace_date_idx on public.financial_ledger(workspace_id,transaction_date desc);
create index ledger_transaction_idx on public.financial_ledger(workspace_id,transaction_id);

-- Read-only balance view; outstanding is derived from non-void allocations, never stored status labels.
create view public.rent_invoice_balances with (security_invoker = true) as
select i.id, i.workspace_id, i.tenant_id, i.property_id, i.invoice_number, i.source, i.description,
 i.period_start, i.period_end, i.due_date, i.amount_paise, i.voided_at, i.created_at,
 coalesce(sum(a.amount_paise) filter (where p.voided_at is null),0)::bigint as paid_paise,
 greatest(i.amount_paise - coalesce(sum(a.amount_paise) filter (where p.voided_at is null),0),0)::bigint as outstanding_paise,
 case when i.voided_at is not null then 'void' when greatest(i.amount_paise - coalesce(sum(a.amount_paise) filter (where p.voided_at is null),0),0)=0 then 'paid'
 when coalesce(sum(a.amount_paise) filter (where p.voided_at is null),0)>0 then 'partially_paid'
 when i.due_date < current_date then 'overdue' else 'unpaid' end as status
from public.rent_invoices i left join public.payment_allocations a on a.workspace_id=i.workspace_id and a.invoice_id=i.id
left join public.payments p on p.workspace_id=a.workspace_id and p.id=a.payment_id
group by i.id;

alter table public.rent_invoices enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.financial_ledger enable row level security;
create policy invoices_read_members on public.rent_invoices for select to authenticated using (public.is_workspace_member(workspace_id));
create policy payments_read_members on public.payments for select to authenticated using (public.is_workspace_member(workspace_id));
create policy allocations_read_members on public.payment_allocations for select to authenticated using (public.is_workspace_member(workspace_id));
create policy ledger_read_members on public.financial_ledger for select to authenticated using (public.is_workspace_member(workspace_id));
grant select on public.rent_invoices, public.payments, public.payment_allocations, public.financial_ledger, public.rent_invoice_balances to authenticated;
revoke insert, update, delete on public.rent_invoices, public.payments, public.payment_allocations, public.financial_ledger from anon, authenticated;

create sequence if not exists public.financial_receipt_seq;
revoke all on sequence public.financial_receipt_seq from public, anon, authenticated;

create or replace function public.create_rent_invoice(p_workspace_id uuid, p_tenant_id uuid, p_description text, p_period_start date, p_period_end date, p_due_date date, p_amount_paise bigint, p_source text default 'manual')
returns public.rent_invoices language plpgsql security definer set search_path='' as $$
declare t public.tenants; inv public.rent_invoices; invno text;
begin
 if auth.uid() is null or not public.workspace_has_role(p_workspace_id,array['owner','admin','member']) then raise exception 'Not authorized to create invoices' using errcode='42501'; end if;
 if p_amount_paise is null or p_amount_paise <= 0 or length(trim(coalesce(p_description,'')))=0 or p_period_end<p_period_start or p_due_date is null then raise exception 'Invalid invoice fields' using errcode='22023'; end if;
 if p_source not in ('manual','rent_charge') then raise exception 'Invalid invoice source' using errcode='22023'; end if;
 select * into t from public.tenants where id=p_tenant_id and workspace_id=p_workspace_id;
 if not found then raise exception 'Tenant is not in the selected workspace' using errcode='23503'; end if;
 invno := 'INV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into public.rent_invoices(workspace_id,tenant_id,property_id,invoice_number,source,description,period_start,period_end,due_date,amount_paise)
 values(p_workspace_id,t.id,t.property_id,invno,p_source,trim(p_description),p_period_start,p_period_end,p_due_date,p_amount_paise) returning * into inv;
 insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,debit_paise)
 values(p_workspace_id,inv.id,'invoice','accounts_receivable',now(),inv.description,inv.invoice_number,p_amount_paise);
 insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,credit_paise)
 values(p_workspace_id,inv.id,'invoice','rent_income',now(),inv.description,inv.invoice_number,p_amount_paise);
 return inv;
end; $$;

create or replace function public.record_rent_payment(p_workspace_id uuid, p_tenant_id uuid, p_amount_paise bigint, p_received_at timestamptz, p_method text, p_reference text, p_notes text, p_idempotency_key uuid, p_allocations jsonb)
returns public.payments language plpgsql security definer set search_path='' as $$
declare t public.tenants; pay public.payments; alloc jsonb; inv public.rent_invoices; alloc_id uuid; alloc_amount bigint; allocated bigint:=0; receipt text; unallocated bigint;
begin
 if auth.uid() is null or not public.workspace_has_role(p_workspace_id,array['owner','admin','member']) then raise exception 'Not authorized to record payments' using errcode='42501'; end if;
 if p_amount_paise is null or p_amount_paise<=0 or p_idempotency_key is null or p_allocations is null or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)>100 then raise exception 'Invalid payment fields' using errcode='22023'; end if;
 select * into pay from public.payments where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then return pay; end if;
 select * into t from public.tenants where id=p_tenant_id and workspace_id=p_workspace_id;
 if not found then raise exception 'Tenant is not in the selected workspace' using errcode='23503'; end if;
 for alloc in select * from jsonb_array_elements(p_allocations) loop
   alloc_id := (alloc->>'invoice_id')::uuid; alloc_amount := (alloc->>'amount_paise')::bigint;
   if alloc_amount is null or alloc_amount<=0 then raise exception 'Allocation must be positive' using errcode='22023'; end if;
   select * into inv from public.rent_invoices where id=alloc_id and workspace_id=p_workspace_id and tenant_id=p_tenant_id and voided_at is null for update;
   if not found then raise exception 'Invoice is not an active invoice for this tenant/workspace' using errcode='23503'; end if;
   if exists(select 1 from public.payment_allocations a join public.payments p on p.id=a.payment_id and p.workspace_id=a.workspace_id where a.workspace_id=p_workspace_id and a.invoice_id=alloc_id and p.voided_at is null and a.payment_id is not null) then null; end if;
   if alloc_amount > (select greatest(inv.amount_paise - coalesce(sum(a.amount_paise) filter(where p.voided_at is null),0),0) from public.payment_allocations a join public.payments p on p.id=a.payment_id and p.workspace_id=a.workspace_id where a.workspace_id=p_workspace_id and a.invoice_id=alloc_id) then raise exception 'Allocation exceeds invoice outstanding balance' using errcode='23514'; end if;
   allocated := allocated + alloc_amount;
 end loop;
 if allocated > p_amount_paise then raise exception 'Allocations exceed payment amount' using errcode='23514'; end if;
 receipt := 'RCT-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('public.financial_receipt_seq')::text,8,'0');
 insert into public.payments(workspace_id,tenant_id,receipt_number,idempotency_key,amount_paise,received_at,method,reference,notes)
 values(p_workspace_id,p_tenant_id,receipt,p_idempotency_key,p_amount_paise,coalesce(p_received_at,now()),p_method, nullif(trim(coalesce(p_reference,'')),''),nullif(trim(coalesce(p_notes,'')),'')) returning * into pay;
 for alloc in select * from jsonb_array_elements(p_allocations) loop
   alloc_id := (alloc->>'invoice_id')::uuid; alloc_amount := (alloc->>'amount_paise')::bigint;
   insert into public.payment_allocations(workspace_id,tenant_id,payment_id,invoice_id,amount_paise) values(p_workspace_id,p_tenant_id,pay.id,alloc_id,alloc_amount);
 end loop;
 unallocated := p_amount_paise - allocated;
 insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,debit_paise)
 values(p_workspace_id,pay.id,'payment','cash',pay.received_at,'Payment received',pay.receipt_number,p_amount_paise);
 if allocated > 0 then insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,credit_paise)
 values(p_workspace_id,pay.id,'payment','accounts_receivable',pay.received_at,'Payment allocated to invoices',pay.receipt_number,allocated); end if;
 if unallocated > 0 then insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,credit_paise)
 values(p_workspace_id,pay.id,'payment','unapplied_receipts',pay.received_at,'Unallocated payment balance',pay.receipt_number,unallocated); end if;
 return pay;
end; $$;

create or replace function public.void_rent_payment(p_workspace_id uuid, p_payment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payments; l record;
begin
 if auth.uid() is null or not public.workspace_has_role(p_workspace_id,array['owner','admin']) then raise exception 'Only owner/admin can void payments' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'A reason of at least 3 characters is required' using errcode='22023'; end if;
 select * into p from public.payments where id=p_payment_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'Payment not found' using errcode='P0002'; end if;
 if p.voided_at is not null then raise exception 'Payment is already voided' using errcode='23514'; end if;
 update public.payments set voided_at=now(), void_reason=trim(p_reason) where id=p.id;
 for l in select * from public.financial_ledger where workspace_id=p_workspace_id and transaction_id=p.id and transaction_type='payment' loop
  insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,debit_paise,credit_paise)
  values(p_workspace_id,p.id,'payment_void',l.account_code,now(),'Reversal: '||l.description,p.receipt_number,l.credit_paise,l.debit_paise);
 end loop;
end; $$;

create or replace function public.void_rent_invoice(p_workspace_id uuid, p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare i public.rent_invoices; l record;
begin
 if auth.uid() is null or not public.workspace_has_role(p_workspace_id,array['owner','admin']) then raise exception 'Only owner/admin can void invoices' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'A reason of at least 3 characters is required' using errcode='22023'; end if;
 select * into i from public.rent_invoices where id=p_invoice_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
 if i.voided_at is not null then raise exception 'Invoice is already voided' using errcode='23514'; end if;
 if exists(select 1 from public.payment_allocations a join public.payments p on p.id=a.payment_id and p.workspace_id=a.workspace_id where a.workspace_id=p_workspace_id and a.invoice_id=i.id and p.voided_at is null) then raise exception 'Void/reverse allocated payments before voiding this invoice' using errcode='23514'; end if;
 update public.rent_invoices set voided_at=now(),void_reason=trim(p_reason) where id=i.id;
 for l in select * from public.financial_ledger where workspace_id=p_workspace_id and transaction_id=i.id and transaction_type='invoice' loop
  insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,debit_paise,credit_paise)
  values(p_workspace_id,i.id,'invoice_void',l.account_code,now(),'Reversal: '||l.description,i.invoice_number,l.credit_paise,l.debit_paise);
 end loop;
end; $$;
revoke all on function public.create_rent_invoice(uuid,uuid,text,date,date,date,bigint,text) from public,anon;
revoke all on function public.record_rent_payment(uuid,uuid,bigint,timestamptz,text,text,text,uuid,jsonb) from public,anon;
revoke all on function public.void_rent_payment(uuid,uuid,text) from public,anon;
revoke all on function public.void_rent_invoice(uuid,uuid,text) from public,anon;
grant execute on function public.create_rent_invoice(uuid,uuid,text,date,date,date,bigint,text) to authenticated;
grant execute on function public.record_rent_payment(uuid,uuid,bigint,timestamptz,text,text,text,uuid,jsonb) to authenticated;
grant execute on function public.void_rent_payment(uuid,uuid,text) to authenticated;
grant execute on function public.void_rent_invoice(uuid,uuid,text) to authenticated;
commit;
