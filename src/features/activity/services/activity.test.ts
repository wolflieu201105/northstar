import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import { makeActivity } from '../../../test/fixtures'
import { fetchActivity } from './activity'

function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { storageKey: `activity-wire-${crypto.randomUUID()}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('activity read contracts', () => {
  it('reads a bounded owned task page with full timestamp/ID precision and safely parses unknown events', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => makeActivity({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, created_at: '2026-11-09T05:00:00.123456+00:00' }))
    const unknown = { ...rows[0], event_type: 'future_event', payload: { version: 7, raw: '<script>bad()</script>' } }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response([unknown, ...rows.slice(1)]))
    const cursor = { id: '00000000-0000-4000-8000-000000000000', createdAt: rows[0].created_at }
    const page = await fetchActivity(clientWith(fetch), 'group-1', 'task-1', cursor)
    const url = new URL(String(fetch.mock.calls[0][0]))
    expect(url.pathname).toBe('/rest/v1/task_activity')
    expect(url.searchParams.get('group_id')).toBe('eq.group-1')
    expect(url.searchParams.get('task_id')).toBe('eq.task-1')
    expect(url.searchParams.get('limit')).toBe('51')
    expect(url.searchParams.get('order')).toBe('created_at.asc,id.asc')
    expect(url.searchParams.get('or')).toBe(`(created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id}))`)
    expect(page.items).toHaveLength(50)
    expect(page.items[0]).toMatchObject({ event_type: 'unknown', originalEventType: 'future_event' })
    expect(page.nextCursor).toEqual({ id: rows[49].id, createdAt: rows[49].created_at })
    expect(fetch.mock.calls[0][1]?.method).toBe('GET')
  })

  it('reports a failed read without generating substitute events', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response({ message: 'History unavailable', code: '42501' }, 403))
    await expect(fetchActivity(clientWith(fetch), 'group-1', 'task-1')).rejects.toThrow('History unavailable')
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][1]?.method).toBe('GET')
  })
})
