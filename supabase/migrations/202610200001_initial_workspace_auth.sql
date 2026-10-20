-- pOS initial identity/workspace schema.
-- Apply with `supabase db push` or run this migration in the Supabase SQL editor.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_memberships_user_id_idx on public.workspace_memberships(user_id);
create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);

-- SECURITY DEFINER helpers avoid recursive membership-table RLS evaluation.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = target_workspace and w.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  new_workspace_id uuid;
  friendly_name text;
begin
  friendly_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');
  insert into public.profiles (id, display_name) values (new.id, friendly_name)
    on conflict (id) do update set display_name = excluded.display_name, updated_at = now();
  insert into public.workspaces (name, owner_id)
    values (coalesce(friendly_name, split_part(new.email, '@', 1), 'My') || '''s workspace', new.id)
    returning id into new_workspace_id;
  insert into public.workspace_memberships (workspace_id, user_id, role)
    values (new_workspace_id, new.id, 'owner') on conflict do nothing;
  return new;
end;
$$;

-- Remove/recreate to make the migration safe to re-run.
drop trigger if exists on_auth_user_created_pos on auth.users;
create trigger on_auth_user_created_pos
after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;

-- Profiles are private to their user for now. Shared profile visibility can be added deliberately later.
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Workspace reads require membership. Only the owner can change workspace metadata or delete it.
drop policy if exists "workspace_select_members" on public.workspaces;
create policy "workspace_select_members" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
drop policy if exists "workspace_insert_owner" on public.workspaces;
create policy "workspace_insert_owner" on public.workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "workspace_update_owner" on public.workspaces;
create policy "workspace_update_owner" on public.workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "workspace_delete_owner" on public.workspaces;
create policy "workspace_delete_owner" on public.workspaces for delete to authenticated using (owner_id = (select auth.uid()));

-- Members can see their own membership; workspace owners can administer membership rows.
drop policy if exists "membership_select_self_or_owner" on public.workspace_memberships;
create policy "membership_select_self_or_owner" on public.workspace_memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_workspace_owner(workspace_id));
drop policy if exists "membership_insert_owner" on public.workspace_memberships;
create policy "membership_insert_owner" on public.workspace_memberships for insert to authenticated
  with check (public.is_workspace_owner(workspace_id) and role <> 'owner');
drop policy if exists "membership_update_owner" on public.workspace_memberships;
create policy "membership_update_owner" on public.workspace_memberships for update to authenticated
  using (public.is_workspace_owner(workspace_id) and role <> 'owner')
  with check (public.is_workspace_owner(workspace_id) and role <> 'owner');
drop policy if exists "membership_delete_owner" on public.workspace_memberships;
create policy "membership_delete_owner" on public.workspace_memberships for delete to authenticated
  using (public.is_workspace_owner(workspace_id) and role <> 'owner');

-- Explicitly grant only the browser-facing operations covered by RLS.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_memberships to authenticated;

commit;
