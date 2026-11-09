import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../types/database'
import { makeTask } from '../test/fixtures'
import { createTask, fetchTasks, updateTask } from './tasks'

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

describe('task service wire contracts', () => {
  it('sends relation arrays separately and preserves timestamp precision', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(makeTask()))
    const client = clientWith(fetch)
    const token = '2026-11-08T14:00:00.000123+00:00'
    await updateTask(client, 'user-1', 'task-1', { title: 'Title', assigneeIds: [], labelIds: ['label-1'] }, token)
    expect(String(fetch.mock.calls[0][0])).toContain('/rpc/save_task')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      p_task_id: 'task-1', p_changes: { title: 'Title' }, p_assignee_ids: [],
      p_label_ids: ['label-1'], p_expected_updated_at: token,
    })
  })

  it('loads related records in the board query rather than requesting each card', async () => {
    const row = { ...makeTask(), task_assignees: [], task_labels: [] }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response([row]))
    const tasks = await fetchTasks(clientWith(fetch), 'user-1')
    expect(tasks[0].assignees).toEqual([])
    const url = new URL(String(fetch.mock.calls[0][0]))
    expect(url.searchParams.get('select')).toContain('task_assignees_member_owner_fkey')
    expect(url.searchParams.get('user_id')).toBe('eq.user-1')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reconciles a lost create response by reading the stable ID', async () => {
    const task = makeTask({ title: 'Created task' })
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response([{ ...task, task_assignees: [], task_labels: [] }]))
    const saved = await createTask(clientWith(fetch), 'user-1', {
      title: 'Created task', description: task.description, status: task.status,
      priority: task.priority, due_date: task.due_date,
    }, 'task-1')
    expect(saved.id).toBe('task-1')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1]?.method).toBe('GET')
  })
})
