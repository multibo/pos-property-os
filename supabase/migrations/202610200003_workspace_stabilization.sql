-- Additive stabilization migration. Safe to apply after the existing domain migration.
begin;

-- Membership/role helpers execute outside caller RLS to avoid recursive membership policies.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid()));
$$;
create or replace function public.workspace_has_role(target_workspace uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_memberships wm
    where wm.workspace_id = target_workspace and wm.user_id = (select auth.uid()) and wm.role = any(allowed_roles));
$$;
revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.workspace_has_role(uuid,text[]) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_has_role(uuid,text[]) to authenticated;

-- A maintenance tenant must be assigned to the same property, not merely the same workspace.
alter table public.tenants drop constraint if exists tenants_workspace_property_id_id_key;
alter table public.tenants add constraint tenants_workspace_property_id_id_key unique (workspace_id, property_id, id);
alter table public.maintenance_requests drop constraint if exists maintenance_tenant_same_property_fk;
alter table public.maintenance_requests add constraint maintenance_tenant_same_property_fk
  foreign key (workspace_id, property_id, tenant_id)
  references public.tenants(workspace_id, property_id, id) on delete restrict;

-- Ensure explicit policies are present without weakening existing permissions.
do $$ declare t text; begin
  foreach t in array array['properties','tenants','maintenance_requests'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read_members', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', t||'_read_members', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert_editors', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.workspace_has_role(workspace_id,array[''owner'',''admin'',''member'']))', t||'_insert_editors', t);
    execute format('drop policy if exists %I on public.%I', t||'_update_editors', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.workspace_has_role(workspace_id,array[''owner'',''admin'',''member''])) with check (public.workspace_has_role(workspace_id,array[''owner'',''admin'',''member'']))', t||'_update_editors', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete_admins', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.workspace_has_role(workspace_id,array[''owner'',''admin'']))', t||'_delete_admins', t);
  end loop;
end $$;
commit;
