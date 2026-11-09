import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import { makeComment } from '../../../test/fixtures'
import { createComment, fetchComments } from './comments'

function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { storageKey: `comment-wire-${crypto.randomUUID()}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('comment service wire contracts', () => {
  it('scopes pagination to the task and group with a precise timestamp/ID cursor and 50-row pages', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => makeComment({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, created_at: '2026-11-09T05:00:00.000123+00:00',
    }))
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(rows))
    const cursor = { id: '00000000-0000-4000-8000-000000000000', createdAt: rows[0].created_at }
    const page = await fetchComments(clientWith(fetch), 'group-1', 'task-1', cursor)
    const url = new URL(String(fetch.mock.calls[0][0]))
    expect(url.pathname).toBe('/rest/v1/comments')
    expect(url.searchParams.get('group_id')).toBe('eq.group-1')
    expect(url.searchParams.get('task_id')).toBe('eq.task-1')
    expect(url.searchParams.get('order')).toBe('created_at.asc,id.asc')
    expect(url.searchParams.get('limit')).toBe('51')
    expect(url.searchParams.get('or')).toBe(`(created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id}))`)
    expect(page.items).toHaveLength(50)
    expect(page.nextCursor).toEqual({ id: rows[49].id, createdAt: rows[49].created_at })
  })

  it('validates comment bodies and sends the group/task/ID without client-authored timestamps', async () => {
    const saved = makeComment({ body: 'First line\nSecond line' })
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(saved))
    const client = clientWith(fetch)
    for (const body of [' \n ', 'a'.repeat(2001)]) await expect(createComment(client, 'group-1', 'task-1', body, saved.id)).rejects.toThrow('1–2,000 characters')
    expect(fetch).not.toHaveBeenCalled()
    expect(await createComment(client, 'group-1', 'task-1', '  First line\nSecond line  ', saved.id)).toEqual(saved)
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ p_comment_id: saved.id, p_group_id: 'group-1', p_task_id: 'task-1', p_body: saved.body })
  })

  it('recovers a lost response by reading the same task-owned comment ID', async () => {
    const saved = makeComment()
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response([saved]))
    expect(await createComment(clientWith(fetch), 'group-1', 'task-1', saved.body, saved.id)).toEqual(saved)
    expect(fetch).toHaveBeenCalledTimes(2)
    const url = new URL(String(fetch.mock.calls[1][0]))
    expect(url.searchParams.get('id')).toBe(`eq.${saved.id}`)
    expect(url.searchParams.get('group_id')).toBe('eq.group-1')
    expect(url.searchParams.get('task_id')).toBe('eq.task-1')
    expect(fetch.mock.calls[1][1]?.method).toBe('GET')
  })

  it('reports uncertainty when reconciliation fails, then reconciles a retry without a second identity', async () => {
    const saved = makeComment()
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response({ code: '42501', message: 'Read unavailable' }, 403))
      .mockResolvedValueOnce(response({ code: '23505', message: 'Already committed' }, 409))
      .mockResolvedValueOnce(response([saved]))
    const client = clientWith(fetch)
    await expect(createComment(client, 'group-1', 'task-1', saved.body, saved.id)).rejects.toMatchObject({ code: 'UNCERTAIN' })
    expect(await createComment(client, 'group-1', 'task-1', saved.body, saved.id)).toEqual(saved)
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).p_comment_id).toBe(JSON.parse(String(fetch.mock.calls[2][1]?.body)).p_comment_id)
  })
})
