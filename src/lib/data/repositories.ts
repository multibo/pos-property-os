import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Workspace, WorkspaceMembership } from './database.types'

/** Common contract for future workspace-scoped domain repositories. Implementations must rely on RLS and validate inputs. */
export interface EntityRepository<TRecord, TCreate, TUpdate> {
  list(workspaceId: string): Promise<TRecord[]>
  get(workspaceId: string, id: string): Promise<TRecord | null>
  create(workspaceId: string, input: TCreate): Promise<TRecord>
  update(workspaceId: string, id: string, input: TUpdate): Promise<TRecord>
  delete(workspaceId: string, id: string): Promise<void>
}

export interface WorkspaceRepository {
  listForCurrentUser(): Promise<Workspace[]>
  getMembership(workspaceId: string): Promise<WorkspaceMembership | null>
}

export class RepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryError'
  }
}

/** Repositories use the signed-in browser client. PostgreSQL RLS is the authority, not client-supplied IDs. */
export function createWorkspaceRepository(client: SupabaseClient<Database>): WorkspaceRepository {
  return {
    async listForCurrentUser() {
      const { data: userResult, error: userError } = await client.auth.getUser()
      if (userError || !userResult.user) throw new RepositoryError('Sign in to load your workspaces.', { cause: userError })
      const { data: memberships, error: membershipError } = await client
        .from('workspace_memberships')
        .select('workspace_id')
        .eq('user_id', userResult.user.id)
        .order('created_at', { ascending: true })
      if (membershipError) throw new RepositoryError('Unable to load your workspace memberships.', { cause: membershipError })
      const ids = (memberships ?? []).map((membership) => membership.workspace_id)
      if (!ids.length) return []
      const { data, error } = await client.from('workspaces').select('*').in('id', ids).order('created_at', { ascending: true })
      if (error) throw new RepositoryError('Unable to load your workspaces.', { cause: error })
      return data ?? []
    },
    async getMembership(workspaceId: string) {
      const { data: userResult, error: userError } = await client.auth.getUser()
      if (userError || !userResult.user) throw new RepositoryError('Sign in to load workspace membership.', { cause: userError })
      const { data, error } = await client
        .from('workspace_memberships')
        .select('workspace_id, user_id, role, created_at')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userResult.user.id)
        .maybeSingle()
      if (error) throw new RepositoryError('Unable to load workspace membership.', { cause: error })
      return data
    },
  }
}
