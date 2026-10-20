import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { propertySchema, tenantSchema, maintenanceSchema, type PropertyInput, type TenantInput, type MaintenanceInput } from './schemas'
import { RepositoryError } from './repositories'

export type Domain = 'properties' | 'tenants' | 'maintenance_requests'
export interface DomainRow {
  id: string; workspace_id: string; created_at: string; updated_at: string
  name?: string; title?: string; address?: string; property_type?: string; unit_count?: number
  status?: string; notes?: string | null; email?: string; phone?: string; property_id?: string
  tenant_id?: string | null; unit_identifier?: string; lease_start?: string; lease_end?: string
  monthly_rent?: number; description?: string; priority?: string; created_date?: string
}
export interface CrudRepository<I> {
  list(workspaceId: string): Promise<DomainRow[]>
  get(workspaceId: string, id: string): Promise<DomainRow | null>
  create(workspaceId: string, input: I): Promise<DomainRow>
  update(workspaceId: string, id: string, input: I): Promise<DomainRow>
  delete(workspaceId: string, id: string): Promise<void>
}
type Result = { data: DomainRow[] | DomainRow | null; error: { message: string } | null }
type Query = PromiseLike<Result> & {
  select(columns?: string): Query; eq(column: string, value: string): Query; order(column: string, options?: { ascending?: boolean }): Query
  insert(values: Record<string, unknown>): Query; update(values: Record<string, unknown>): Query; delete(): Query
  single(): Promise<Result>; maybeSingle(): Promise<Result>
}
function repository<I>(client: SupabaseClient<Database>, table: Domain, validate: (v: unknown) => I): CrudRepository<I> {
  const fail = (message: string, error?: unknown): never => { throw new RepositoryError(message, { cause: error }) }
  // Dynamic table selection is isolated behind this narrow adapter; runtime RLS remains authoritative.
  const query = () => client.from(table as never) as unknown as Query
  return {
    async list(workspaceId) {
      const { data, error } = await query().select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
      if (error) fail('Unable to load records. Check workspace access and connection.', error)
      return Array.isArray(data) ? data : []
    },
    async get(workspaceId, id) {
      const { data, error } = await query().select('*').eq('workspace_id', workspaceId).eq('id', id).maybeSingle()
      if (error) fail('Unable to load record.', error)
      return data && !Array.isArray(data) ? data : null
    },
    async create(workspaceId, input) {
      const parsed = validate(input)
      const { data, error } = await query().insert({ ...(parsed as object), workspace_id: workspaceId } as Record<string, unknown>).select('*').single()
      if (error || !data || Array.isArray(data)) fail('Unable to create record. Check permissions and related records.', error)
      return data as DomainRow
    },
    async update(workspaceId, id, input) {
      const parsed = validate(input)
      const { data, error } = await query().update(parsed as Record<string, unknown>).eq('workspace_id', workspaceId).eq('id', id).select('*').single()
      if (error || !data || Array.isArray(data)) fail('Unable to save changes. The record may have been deleted or access may have changed.', error)
      return data as DomainRow
    },
    async delete(workspaceId, id) {
      const { error } = await query().delete().eq('workspace_id', workspaceId).eq('id', id)
      if (error) fail('Unable to delete record. Related records may need to be removed first.', error)
    },
  }
}
export const createPropertyRepository = (client: SupabaseClient<Database>) => repository<PropertyInput>(client, 'properties', v => propertySchema.parse(v))
export const createTenantRepository = (client: SupabaseClient<Database>) => repository<TenantInput>(client, 'tenants', v => tenantSchema.parse(v))
export const createMaintenanceRepository = (client: SupabaseClient<Database>) => repository<MaintenanceInput>(client, 'maintenance_requests', v => maintenanceSchema.parse(v))
