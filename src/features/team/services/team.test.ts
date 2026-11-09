import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import { makeMember } from '../../../test/fixtures'
import { archiveMember, createMember, updateMember } from './team'

function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
const response = () => new Response(JSON.stringify([makeMember()]), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('member service wire contracts', () => {
  it('rejects invalid names before issuing requests and creates with a stable owned ID', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response())
    const client = clientWith(fetch)
    await expect(createMember(client, 'user-1', { name: ' ', avatar_color: null }, 'member-1')).rejects.toThrow('1–80 characters')
    await expect(createMember(client, 'user-1', { name: 'a'.repeat(81), avatar_color: null }, 'member-1')).rejects.toThrow('1–80 characters')
    expect(fetch).not.toHaveBeenCalled()
    await createMember(client, 'user-1', { name: '  Alex Lee  ', avatar_color: null }, 'member-1')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ id: 'member-1', user_id: 'user-1', name: 'Alex Lee', avatar_color: null })
  })

  it('scopes editing and archival to the owner and member without changing task links', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => response())
    const client = clientWith(fetch)
    await updateMember(client, 'user-1', 'member-1', { name: 'Renamed', avatar_color: '#166b45' })
    await archiveMember(client, 'user-1', 'member-1', true)
    await archiveMember(client, 'user-1', 'member-1', false)
    for (const [url, options] of fetch.mock.calls) {
      const request = new URL(String(url))
      expect(request.pathname).toBe('/rest/v1/team_members')
      expect(request.searchParams.get('user_id')).toBe('eq.user-1')
      expect(request.searchParams.get('id')).toBe('eq.member-1')
      expect(options?.method).toBe('PATCH')
    }
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ name: 'Renamed', avatar_color: '#166b45' })
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ archived_at: expect.any(String) })
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({ archived_at: null })
  })
})
