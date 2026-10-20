begin;

-- Additive hardening: preserve existing financial records and function signatures.
-- Fingerprints bind an idempotency key to the complete normalized request payload.
alter table public.payments add column if not exists request_fingerprint text;

create or replace function public.record_rent_payment(
 p_workspace_id uuid, p_tenant_id uuid, p_amount_paise bigint, p_received_at timestamptz,
 p_method text, p_reference text, p_notes text, p_idempotency_key uuid, p_allocations jsonb
) returns public.payments
language plpgsql security definer set search_path='' as $$
declare
 t public.tenants;
 pay public.payments;
 alloc jsonb;
 inv public.rent_invoices;
 alloc_id uuid;
 alloc_amount bigint;
 allocated bigint:=0;
 receipt text;
 unallocated bigint;
 fingerprint text;
 normalized_allocations jsonb;
begin
 if auth.uid() is null or not public.workspace_has_role(p_workspace_id,array['owner','admin','member']) then
   raise exception 'Not authorized to record payments' using errcode='42501';
 end if;
 if p_workspace_id is null or p_tenant_id is null or p_amount_paise is null or p_amount_paise<=0 or p_amount_paise>9007199254740991
   or p_idempotency_key is null or p_allocations is null or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)>100
   or p_method not in ('Cash','Bank transfer','Cheque','UPI','Other') then
   raise exception 'Invalid payment fields' using errcode='22023';
 end if;

 -- Normalize the allocation list so array order and JSON object key order do not
 -- change request identity. Duplicate invoice entries are rejected explicitly.
 begin
   select coalesce(jsonb_agg(jsonb_build_object(
      'invoice_id', x.invoice_id::text, 'amount_paise', x.amount_paise
    ) order by x.invoice_id), '[]'::jsonb)
   into normalized_allocations
   from (
     select (e.value->>'invoice_id')::uuid as invoice_id,
            (e.value->>'amount_paise')::bigint as amount_paise
     from jsonb_array_elements(p_allocations) e(value)
   ) x;
 exception when others then
   raise exception 'Invalid allocation format: invoice_id must be a UUID and amount_paise must be an integer' using errcode='22023';
 end;
 if exists(select 1 from jsonb_array_elements(normalized_allocations) e(value)
           where (e.value->>'amount_paise')::bigint is null
              or (e.value->>'amount_paise')::bigint<=0
              or (e.value->>'amount_paise')::bigint>9007199254740991) then
   raise exception 'Allocation amounts must be positive integer paise within the supported limit' using errcode='22023';
 end if;
 if (select count(*) from jsonb_array_elements(normalized_allocations)) < jsonb_array_length(p_allocations) then
   raise exception 'Invalid allocation format' using errcode='22023';
 end if;
 if (select count(*) from jsonb_array_elements(normalized_allocations)) <>
    (select count(distinct e.value->>'invoice_id') from jsonb_array_elements(normalized_allocations) e(value)) then
   raise exception 'Each invoice may appear only once in the allocation list' using errcode='22023';
 end if;

 fingerprint := jsonb_build_object(
   'workspace_id',p_workspace_id,'tenant_id',p_tenant_id,'amount_paise',p_amount_paise,
   'received_at',p_received_at,'method',p_method,'reference',nullif(trim(coalesce(p_reference,'')),''),
   'notes',nullif(trim(coalesce(p_notes,'')),''),'allocations',normalized_allocations
 )::text;

 -- Serialize requests sharing a key, including first-time concurrent requests.
 perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_idempotency_key::text, 0));
 select * into pay from public.payments
  where workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
   if pay.request_fingerprint is null then
     raise exception 'This idempotency key belongs to a payment created before request fingerprinting; submit with a new key' using errcode='23505';
   end if;
   if pay.request_fingerprint <> fingerprint then
     raise exception 'Idempotency key was already used with different payment details' using errcode='23505';
   end if;
   return pay;
 end if;

 select * into t from public.tenants where id=p_tenant_id and workspace_id=p_workspace_id;
 if not found then raise exception 'Tenant is not in the selected workspace' using errcode='23503'; end if;

 -- Lock all target invoices in a stable order before checking balances. This
 -- serializes competing payments against the same invoice and avoids lock-order deadlocks.
 perform i.id from public.rent_invoices i
   join jsonb_array_elements(normalized_allocations) e(value) on i.id=(e.value->>'invoice_id')::uuid
  where i.workspace_id=p_workspace_id and i.tenant_id=p_tenant_id and i.voided_at is null
  order by i.id for update of i;

 for alloc in select value from jsonb_array_elements(normalized_allocations) order by value->>'invoice_id' loop
   alloc_id := (alloc->>'invoice_id')::uuid;
   alloc_amount := (alloc->>'amount_paise')::bigint;
   select * into inv from public.rent_invoices
    where id=alloc_id and workspace_id=p_workspace_id and tenant_id=p_tenant_id and voided_at is null;
   if not found then raise exception 'Invoice is not an active invoice for this tenant/workspace' using errcode='23503'; end if;
   if alloc_amount > (
     select greatest(inv.amount_paise - coalesce(sum(a.amount_paise) filter(where p.voided_at is null),0),0)
     from public.payment_allocations a
     join public.payments p on p.id=a.payment_id and p.workspace_id=a.workspace_id
     where a.workspace_id=p_workspace_id and a.invoice_id=alloc_id
   ) then raise exception 'Allocation exceeds invoice outstanding balance' using errcode='23514'; end if;
   allocated := allocated + alloc_amount;
 end loop;
 if allocated > p_amount_paise then raise exception 'Allocations exceed payment amount' using errcode='23514'; end if;

 receipt := 'RCT-' || to_char(coalesce(p_received_at,now()),'YYYYMMDD') || '-' || lpad(nextval('public.financial_receipt_seq')::text,8,'0');
 insert into public.payments(workspace_id,tenant_id,receipt_number,idempotency_key,request_fingerprint,amount_paise,received_at,method,reference,notes)
 values(p_workspace_id,p_tenant_id,receipt,p_idempotency_key,fingerprint,p_amount_paise,coalesce(p_received_at,now()),p_method,
        nullif(trim(coalesce(p_reference,'')),''),nullif(trim(coalesce(p_notes,'')),'')) returning * into pay;

 for alloc in select value from jsonb_array_elements(normalized_allocations) order by value->>'invoice_id' loop
   insert into public.payment_allocations(workspace_id,tenant_id,payment_id,invoice_id,amount_paise)
   values(p_workspace_id,p_tenant_id,pay.id,(alloc->>'invoice_id')::uuid,(alloc->>'amount_paise')::bigint);
 end loop;
 unallocated := p_amount_paise - allocated;
 insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,debit_paise)
 values(p_workspace_id,pay.id,'payment','cash',pay.received_at,'Payment received',pay.receipt_number,p_amount_paise);
 if allocated > 0 then
   insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,credit_paise)
   values(p_workspace_id,pay.id,'payment','accounts_receivable',pay.received_at,'Payment allocated to invoices',pay.receipt_number,allocated);
 end if;
 if unallocated > 0 then
   insert into public.financial_ledger(workspace_id,transaction_id,transaction_type,account_code,transaction_date,description,reference,credit_paise)
   values(p_workspace_id,pay.id,'payment','unapplied_receipts',pay.received_at,'Unallocated payment balance',pay.receipt_number,unallocated);
 end if;
 return pay;
end; $$;

revoke all on function public.record_rent_payment(uuid,uuid,bigint,timestamptz,text,text,text,uuid,jsonb) from public, anon;
grant execute on function public.record_rent_payment(uuid,uuid,bigint,timestamptz,text,text,text,uuid,jsonb) to authenticated;

-- Fingerprints are internal idempotency metadata; clients have no direct write grants.
comment on column public.payments.request_fingerprint is 'Canonical JSON text of normalized immutable payment request fields, used to reject idempotency-key payload changes without relying on hash collision resistance.';

commit;
