import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import type { LabelDraft } from '../types'
import { makeLabel } from '../../../test/fixtures'
import { archiveLabel, createLabel, updateLabel } from './labels'

function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { storageKey: `label-wire-${crypto.randomUUID()}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('label service wire contracts', () => {
  it('validates names/colors and sends only normalized fields and stable owned identity', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(makeLabel()))
    const client = clientWith(fetch)
    for (const name of [' ', 'a'.repeat(41)]) await expect(createLabel(client, 'user-1', { name, color: '#20895b' }, 'label-1')).rejects.toThrow('1–40 characters')
    await expect(createLabel(client, 'user-1', { name: 'Bug', color: '#000000' as LabelDraft['color'] }, 'label-1')).rejects.toThrow('available label color')
    expect(fetch).not.toHaveBeenCalled()
    await createLabel(client, 'user-1', { name: '  Bug  ', color: '#20895b' }, 'label-1')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ id: 'label-1', user_id: 'user-1', name: 'Bug', color: '#20895b' })
  })

  it('returns a recoverable archived-name conflict with literal punctuation and an owner-scoped lookup', async () => {
    const name = 'QA_*%\\done'
    const archived = makeLabel({ id: 'existing', name, archived_at: '2026-11-08T14:00:00Z' })
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ code: '23505', message: 'duplicate key' }, 409))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([makeLabel({ id: 'unrelated', name: 'QA-something-else' }), archived]))
    await expect(createLabel(clientWith(fetch), 'user-1', { name, color: '#20895b' }, 'new-id')).rejects.toMatchObject({ code: '23505', existingLabel: archived })
    const url = new URL(String(fetch.mock.calls[2][0]))
    expect(url.searchParams.get('user_id')).toBe('eq.user-1')
    expect(url.searchParams.has('name')).toBe(false)
    expect(fetch.mock.calls[2][1]?.method).toBe('GET')
  })

  it('handles rename conflicts and scopes archive/restore writes without touching task links', async () => {
    const existing = makeLabel({ id: 'other-label' })
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ code: '23505', message: 'duplicate key' }, 409))
      .mockResolvedValueOnce(response([existing]))
      .mockImplementation(async () => response([makeLabel()]))
    const client = clientWith(fetch)
    await expect(updateLabel(client, 'user-1', 'label-1', { name: 'bUG', color: '#20895b' })).rejects.toMatchObject({ existingLabel: existing })
    await archiveLabel(client, 'user-1', 'label-1', true)
    await archiveLabel(client, 'user-1', 'label-1', false)
    for (const index of [0, 2, 3]) {
      const [url, options] = fetch.mock.calls[index]
      const request = new URL(String(url))
      expect(request.pathname).toBe('/rest/v1/labels')
      expect(request.searchParams.get('user_id')).toBe('eq.user-1')
      expect(request.searchParams.get('id')).toBe('eq.label-1')
      expect(options?.method).toBe('PATCH')
    }
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ name: 'bUG', color: '#20895b' })
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toEqual({ archived_at: expect.any(String) })
    expect(JSON.parse(String(fetch.mock.calls[3][1]?.body))).toEqual({ archived_at: null })
  })

  it('reconciles a lost create response against its original owned ID', async () => {
    const label = makeLabel()
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response([label]))
    expect(await createLabel(clientWith(fetch), 'user-1', { name: label.name, color: '#20895b' }, label.id)).toEqual(label)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get('id')).toBe(`eq.${label.id}`)
    expect(fetch.mock.calls[1][1]?.method).toBe('GET')
  })
})
