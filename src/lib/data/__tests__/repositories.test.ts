import { describe, expect, it, vi } from 'vitest'
import { createWorkspaceRepository, RepositoryError } from '../repositories'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types'

function clientMock(overrides: Record<string, unknown> = {}) {
  const auth = { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null }) }
  const client = { auth, ...overrides } as unknown as SupabaseClient<Database>
  return { client, auth }
}

describe('workspace repository', () => {
  it('requires an authenticated user before querying memberships', async () => {
    const { client, auth } = clientMock()
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null } as never)
    const repo = createWorkspaceRepository(client)
    await expect(repo.listForCurrentUser()).rejects.toBeInstanceOf(RepositoryError)
  })

  it('returns an empty list without querying workspace rows when membership list is empty', async () => {
    const membershipQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) }
    const from = vi.fn().mockReturnValue(membershipQuery)
    const { client } = clientMock({ from })
    const result = await createWorkspaceRepository(client).listForCurrentUser()
    expect(result).toEqual([])
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('wraps backend errors with a stable repository error message', async () => {
    const membershipQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: null, error: new Error('RLS denied') }) }
    const { client } = clientMock({ from: vi.fn().mockReturnValue(membershipQuery) })
    await expect(createWorkspaceRepository(client).listForCurrentUser()).rejects.toThrow('Unable to load your workspace memberships.')
  })
})
