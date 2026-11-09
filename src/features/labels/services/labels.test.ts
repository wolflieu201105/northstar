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
describe('group label wire contracts', () => {
  it('validates names/colors and sends normalized fields through the checked RPC', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(makeLabel()))
    const client = clientWith(fetch)
    for (const name of [' ', 'a'.repeat(41)]) await expect(createLabel(client, 'group-1', { name, color: '#20895b' }, 'label-1')).rejects.toThrow('1–40 characters')
    await expect(createLabel(client, 'group-1', { name: 'Bug', color: '#000000' as LabelDraft['color'] }, 'label-1')).rejects.toThrow('available label color')
    expect(fetch).not.toHaveBeenCalled()
    await createLabel(client, 'group-1', { name: '  Bug  ', color: '#20895b' }, 'label-1')
    expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe('/rest/v1/rpc/save_label')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ p_group_id: 'group-1', p_label_id: 'label-1', p_name: 'Bug', p_color: '#20895b' })
  })
  it('looks up archived-name conflicts within the group using literal punctuation', async () => {
    const name = 'QA_*%done'
    const archived = makeLabel({ id: 'existing', name, archived_at: '2026-11-08T14:00:00Z' })
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(response({ code: '23505', message: 'duplicate key' }, 409))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([makeLabel({ id: 'unrelated', name: 'QA-something-else' }), archived]))
    await expect(createLabel(clientWith(fetch), 'group-1', { name, color: '#20895b' }, 'new-id')).rejects.toMatchObject({ code: '23505', existingLabel: archived })
    const url = new URL(String(fetch.mock.calls[2][0]))
    expect(url.searchParams.get('group_id')).toBe('eq.group-1')
    expect(url.searchParams.has('name')).toBe(false)
  })
  it('passes exact edit tokens for rename, archive, and restore without client timestamps', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => response(makeLabel()))
    const client = clientWith(fetch)
    const token = '2026-11-09T14:00:00.123456+00:00'
    await updateLabel(client, 'group-1', 'label-1', { name: 'Bug', color: '#20895b' }, token)
    await archiveLabel(client, 'group-1', 'label-1', true, token)
    await archiveLabel(client, 'group-1', 'label-1', false, token)
    for (const call of fetch.mock.calls) {
      expect(new URL(String(call[0])).pathname).toBe('/rest/v1/rpc/save_label')
      expect(call[1]?.method).toBe('POST')
      expect(JSON.parse(String(call[1]?.body))).toMatchObject({ p_group_id: 'group-1', p_label_id: 'label-1', p_expected_updated_at: token })
    }
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toHaveProperty('p_archived', true)
    expect(JSON.parse(String(fetch.mock.calls[2][1]?.body))).toHaveProperty('p_archived', false)
  })
  it('reconciles a lost create response against its stable ID and normalized input', async () => {
    const label = makeLabel()
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(response([label]))
    expect(await createLabel(clientWith(fetch), 'group-1', { name: label.name, color: '#20895b' }, label.id)).toEqual(label)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1]?.method).toBe('GET')
    expect(new URL(String(fetch.mock.calls[1][0])).searchParams.get('group_id')).toBe('eq.group-1')
  })
})
