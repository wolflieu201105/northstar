import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../shared/lib/supabase'
import type { TeamMember } from '../team/types'
import { fetchTeamMembers, createMember } from '../team/services/team'
import { fetchLabels } from '../labels/services/labels'
import { useWorkspaceData } from './useWorkspaceData'

vi.mock('../team/services/team', () => ({ fetchTeamMembers: vi.fn(), createMember: vi.fn(), updateMember: vi.fn(), archiveMember: vi.fn() }))
vi.mock('../labels/services/labels', () => ({ fetchLabels: vi.fn(), createLabel: vi.fn(), updateLabel: vi.fn(), archiveLabel: vi.fn() }))
const client = {} as AppClient
const member: TeamMember = {
  id: 'member-1', user_id: 'user-1', name: 'Alex', avatar_color: null, archived_at: null,
  created_at: '2026-11-08T14:00:00Z', updated_at: '2026-11-08T14:00:00Z',
}

describe('useWorkspaceData', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(fetchLabels).mockResolvedValue([]) })
  it('loads labels independently while members are pending', async () => {
    let finish!: (rows: TeamMember[]) => void
    vi.mocked(fetchTeamMembers).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useWorkspaceData(client, 'user-1'))
    await waitFor(() => expect(result.current.labelsLoading).toBe(false))
    expect(fetchTeamMembers).toHaveBeenCalledOnce()
    expect(result.current.membersLoading).toBe(true)
    await act(async () => { finish([member]) })
    expect(result.current.members).toEqual([member])
  })
  it('refetches a stale initial list after a member is created', async () => {
    let finish!: (rows: TeamMember[]) => void
    const added = { ...member, id: 'member-2', name: 'Sam' }
    vi.mocked(fetchTeamMembers).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
      .mockResolvedValueOnce([member, added])
    vi.mocked(createMember).mockResolvedValue(added)
    const { result } = renderHook(() => useWorkspaceData(client, 'user-1'))
    await act(async () => { await result.current.addMember({ name: 'Sam', avatar_color: null }) })
    await act(async () => { finish([member]) })
    await waitFor(() => expect(result.current.members).toEqual([member, added]))
    expect(fetchTeamMembers).toHaveBeenCalledTimes(2)
  })
})
