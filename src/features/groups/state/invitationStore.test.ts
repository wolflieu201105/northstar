import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import { makeInvitation } from '../../../test/fixtures'
import { fetchInvitations } from '../services/groups'
import { createInvitationStore } from './invitationStore'
vi.mock('../services/groups', () => ({ fetchInvitations: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
describe('invitation pages', () => {
  it('retries a failed cursor and ignores late pages after a response resolves the invitation', async () => {
    const first = makeInvitation()
    const cursor = { createdAt: first.created_at, id: first.id }
    let finish!: (value: Awaited<ReturnType<typeof fetchInvitations>>) => void
    vi.mocked(fetchInvitations).mockResolvedValueOnce({ items: [first], nextCursor: cursor })
      .mockRejectedValueOnce(new Error('Offline'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const store = createInvitationStore({} as AppClient, 'user-1')
    store.start()
    await vi.waitFor(() => expect(store.getSnapshot().loading).toBe(false))
    await store.load(true)
    expect(store.getSnapshot().failedMore).toBe(true)
    const pending = store.load(true)
    expect(vi.mocked(fetchInvitations).mock.calls[2][1]).toEqual(cursor)
    store.updateInvitation({ ...first, status: 'revoked' })
    finish({ items: [first], nextCursor: null })
    await pending
    expect(store.getSnapshot().items[0].status).toBe('revoked')
    store.stop()
  })
  it('ignores a stopped account request', async () => {
    let finish!: (value: Awaited<ReturnType<typeof fetchInvitations>>) => void
    vi.mocked(fetchInvitations).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const old = createInvitationStore({} as AppClient, 'user-A')
    old.start(); old.stop()
    finish({ items: [makeInvitation()], nextCursor: null })
    await Promise.resolve()
    expect(old.getSnapshot().items).toEqual([])
  })
})
