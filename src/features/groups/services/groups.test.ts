import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import { makeGroup, makeInvitation, makeMembership } from '../../../test/fixtures'
import { createGroup, fetchInvitations, fetchMembers, lookupTarget, respondInvitation, revokeInvitation, sendInvitation } from './groups'

const response = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
function connection() {
  const fetch = vi.fn<typeof globalThis.fetch>()
  const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { storageKey: crypto.randomUUID(), persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { fetch, client, body(index = 0) { return JSON.parse(String(fetch.mock.calls[index][1]?.body)) } }
}
describe('group API contracts', () => {
  it('creates a group with a stable request ID and never inserts membership from the browser', async () => {
    const c = connection()
    c.fetch.mockImplementation(async () => response(makeGroup()))
    await createGroup(c.client, ' Launch ', 'group-1')
    await createGroup(c.client, ' Launch ', 'group-1')
    expect(c.body()).toEqual({ p_name: 'Launch', p_group_id: 'group-1' })
    expect(c.body(1)).toEqual(c.body())
    expect(String(c.fetch.mock.calls[0][0])).toContain('/rpc/create_group')
  })
  it('resolves only an exact username or ID through the restricted lookup RPC', async () => {
    const c = connection()
    c.fetch.mockResolvedValueOnce(response(null))
    expect(await lookupTarget(c.client, 'group-1', ' exact_name ')).toBeNull()
    expect(c.body()).toEqual({ p_group_id: 'group-1', p_query: 'exact_name' })
    expect(String(c.fetch.mock.calls[0][0])).toContain('/rpc/lookup_invitation_target')
  })
  it('uses accepted membership and actual profiles for the member directory', async () => {
    const c = connection()
    c.fetch.mockResolvedValueOnce(response([makeMembership()]))
    expect(await fetchMembers(c.client, 'group-1')).toEqual([makeMembership()])
    const url = new URL(String(c.fetch.mock.calls[0][0]))
    expect(url.searchParams.get('group_id')).toBe('eq.group-1')
    expect(url.searchParams.get('select')).toContain('group_members_user_id_fkey')
    expect(c.fetch.mock.calls[0][1]?.method).toBe('GET')
  })
  it('keeps invitation identities stable and renders the actual terminal response', async () => {
    const c = connection()
    c.fetch.mockResolvedValueOnce(response(makeInvitation()))
      .mockResolvedValueOnce(response(makeInvitation({ status: 'revoked' })))
      .mockResolvedValueOnce(response(makeInvitation({ status: 'accepted' })))
    await sendInvitation(c.client, 'group-1', 'user-2', 'invite-1')
    expect(c.body()).toEqual({ p_group_id: 'group-1', p_recipient_user_id: 'user-2', p_invitation_id: 'invite-1' })
    expect((await respondInvitation(c.client, 'invite-1', true)).status).toBe('revoked')
    expect((await revokeInvitation(c.client, 'invite-1')).status).toBe('accepted')
    expect(c.body(1)).toEqual({ p_invitation_id: 'invite-1', p_accept: true })
  })
  it('paginates the authorized inbox without rounding its newest-first cursor', async () => {
    const c = connection()
    const rows = Array.from({ length: 50 }, (_, index) => makeInvitation({ id: `invite-${index}` }))
    c.fetch.mockResolvedValueOnce(response(rows))
    const cursor = { createdAt: '2026-11-09T14:00:00.123456+00:00', id: 'before-id' }
    const page = await fetchInvitations(c.client, cursor)
    expect(c.body()).toEqual({ p_limit: 50, p_before_time: cursor.createdAt, p_before_id: cursor.id })
    expect(page.nextCursor).toEqual({ createdAt: rows[49].created_at, id: rows[49].id })
    expect(page.items).toHaveLength(50)
  })
})
