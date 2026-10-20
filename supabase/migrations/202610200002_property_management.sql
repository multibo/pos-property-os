begin;
-- Role helper is SECURITY DEFINER to avoid recursive membership RLS.
create or replace function public.workspace_has_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.workspace_memberships wm where wm.workspace_id=target_workspace
 and wm.user_id=(select auth.uid()) and wm.role = any(allowed_roles));
$$;
revoke all on function public.workspace_has_role(uuid,text[]) from public;
grant execute on function public.workspace_has_role(uuid,text[]) to authenticated;

create table public.properties (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 name text not null check(char_length(trim(name)) between 1 and 160),
 address text not null check(char_length(trim(address)) between 1 and 500),
 property_type text not null check(property_type in ('Apartment','House','Condo','Multi-family','Commercial','Other')),
 unit_count integer not null check(unit_count > 0),
 status text not null default 'Active' check(status in ('Active','Inactive')),
 notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create table public.tenants (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 property_id uuid not null,
 name text not null check(char_length(trim(name)) between 1 and 160),
 email text not null check(email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
 phone text not null check(char_length(trim(phone)) between 1 and 40),
 unit_identifier text not null check(char_length(trim(unit_identifier)) between 0 and 80),
 lease_start date not null, lease_end date not null check(lease_end >= lease_start),
 monthly_rent numeric(12,2) not null check(monthly_rent >= 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 constraint tenants_property_workspace_fk foreign key(workspace_id,property_id) references public.properties(workspace_id,id) on delete restrict
);
create table public.maintenance_requests (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 property_id uuid not null,
 tenant_id uuid,
 title text not null check(char_length(trim(title)) between 1 and 200),
 description text not null check(char_length(trim(description)) between 1 and 5000),
 priority text not null default 'Normal' check(priority in ('Low','Normal','High','Urgent')),
 status text not null default 'Open' check(status in ('Open','In Progress','Resolved')),
 created_date date not null default current_date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint maintenance_property_workspace_fk foreign key(workspace_id,property_id) references public.properties(workspace_id,id) on delete restrict,
 constraint maintenance_tenant_workspace_fk foreign key(workspace_id,tenant_id) references public.tenants(workspace_id,id) on delete set null
);
create index properties_workspace_idx on public.properties(workspace_id);
create index tenants_workspace_property_idx on public.tenants(workspace_id,property_id);
create index maintenance_workspace_status_idx on public.maintenance_requests(workspace_id,status,priority);
create index maintenance_workspace_property_idx on public.maintenance_requests(workspace_id,property_id);
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;
create trigger properties_touch before update on public.properties for each row execute function public.touch_updated_at();
create trigger tenants_touch before update on public.tenants for each row execute function public.touch_updated_at();
create trigger maintenance_touch before update on public.maintenance_requests for each row execute function public.touch_updated_at();
alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.maintenance_requests enable row level security;
do $$ declare t text; begin
 foreach t in array array['properties','tenants','maintenance_requests'] loop
 execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',t||'_read_members',t);
 execute format('create policy %I on public.%I for insert to authenticated with check (public.workspace_has_role(workspace_id,array[''owner'',''admin'',''member'']))',t||'_insert_editors',t);
 execute format('create policy %I on public.%I for update to authenticated using (public.workspace_has_role(workspace_id,array[''owner'',''admin'',''member''])) with check (public.workspace_has_role(workspace_id,array[''owner'',''admin'',''member'']))',t||'_update_editors',t);
 execute format('create policy %I on public.%I for delete to authenticated using (public.workspace_has_role(workspace_id,array[''owner'',''admin'']))',t||'_delete_admins',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 end loop;
end $$;
-- Tenant and maintenance relations are additionally constrained by composite workspace foreign keys.
-- Tenant deletion is restricted while maintenance rows reference it; users must unlink or delete requests first.
alter table public.maintenance_requests drop constraint maintenance_tenant_workspace_fk;
alter table public.maintenance_requests add constraint maintenance_tenant_workspace_fk
 foreign key(workspace_id,tenant_id) references public.tenants(workspace_id,id) on delete restrict;
commit;
