import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../shared/lib/supabase'
import type { GroupMember } from '../groups/types'
import { fetchMembers } from '../groups/services/groups'
import { fetchLabels, updateLabel } from '../labels/services/labels'
import { makeLabel, makeMembership } from '../../test/fixtures'
import { useWorkspaceData } from './useWorkspaceData'

vi.mock('../groups/services/groups', () => ({ fetchMembers: vi.fn() }))
vi.mock('../labels/services/labels', () => ({ fetchLabels: vi.fn(), createLabel: vi.fn(), updateLabel: vi.fn(), archiveLabel: vi.fn() }))
const client = {} as AppClient
beforeEach(() => { vi.resetAllMocks(); vi.mocked(fetchLabels).mockResolvedValue([]) })
describe('group lookup resources', () => {
  it('loads labels independently and exposes only accepted active member profiles', async () => {
    let finish!: (rows: GroupMember[]) => void
    vi.mocked(fetchMembers).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useWorkspaceData(client, 'user-1', 'group-1'))
    await waitFor(() => expect(result.current.labelsLoading).toBe(false))
    expect(result.current.membersLoading).toBe(true)
    await act(async () => { finish([makeMembership(), makeMembership({ user_id: 'inactive', is_active: false })]) })
    expect(result.current.members).toEqual([makeMembership().profile])
    expect(fetchMembers).toHaveBeenCalledWith(client, 'group-1')
  })
  it('isolates late lookup responses when groups change under the same identity', async () => {
    let finish!: (rows: GroupMember[]) => void
    vi.mocked(fetchMembers).mockReturnValueOnce(new Promise((resolve) => { finish = resolve })).mockResolvedValue([])
    const { result, rerender } = renderHook(({ group }) => useWorkspaceData(client, 'user-1', group), { initialProps: { group: 'group-1' } })
    rerender({ group: 'group-2' })
    await waitFor(() => expect(result.current.membersLoading).toBe(false))
    await act(async () => { finish([makeMembership()]) })
    expect(result.current.members).toEqual([])
  })
  it('passes the editor baseline token instead of adopting a newer label revision', async () => {
    const label = makeLabel({ updated_at: '2026-11-09T14:00:00.123456Z' })
    vi.mocked(fetchMembers).mockResolvedValue([])
    vi.mocked(fetchLabels).mockResolvedValue([label])
    vi.mocked(updateLabel).mockResolvedValue(label)
    const { result } = renderHook(() => useWorkspaceData(client, 'user-1', 'group-1'))
    await waitFor(() => expect(result.current.labelsLoading).toBe(false))
    const baseline = '2026-11-09T13:00:00.000001Z'
    await act(async () => { await result.current.editLabel(label.id, { name: 'Bug', color: '#20895b' }, baseline) })
    expect(updateLabel).toHaveBeenCalledWith(client, 'group-1', label.id, { name: 'Bug', color: '#20895b' }, baseline)
  })
})
