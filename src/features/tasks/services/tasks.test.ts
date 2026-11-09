import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import { makeTask, makeMember, makeLabel } from '../../../test/fixtures'
import { createTask, deleteTask, fetchTasks, updateTask } from './tasks'

function response(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
function clientWith(fetch: typeof globalThis.fetch) {
  return createClient<Database>('https://example.supabase.co', 'sb_publishable_test', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

describe('task service wire contracts', () => {
  it('resolves assignees through actual membership profiles, including tasks created by another user', async () => {
    const member = makeMember()
    const label = makeLabel()
    const task = makeTask({ created_by_user_id: 'another-user', created_by_name: 'Morgan' })
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response([{ ...task,
      task_assignments: [{ member: { profile: member } }], task_labels: [{ label }],
    }]))
    expect((await fetchTasks(clientWith(fetch), 'group-1'))[0]).toMatchObject({ created_by_name: 'Morgan', assignees: [member], labels: [label] })
  })
  it('deletes through the group RPC with the exact revision token', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response({ deleted: true, task_id: 'task-1' }))
    const token = '2026-11-09T14:00:00.123456+00:00'
    await deleteTask(clientWith(fetch), 'group-1', 'task-1', token)
    expect(String(fetch.mock.calls[0][0])).toContain('/rpc/delete_task')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ p_group_id: 'group-1', p_task_id: 'task-1', p_expected_updated_at: token })
  })
  it('sends relation arrays separately and preserves timestamp precision', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(makeTask()))
    const client = clientWith(fetch)
    const token = '2026-11-08T14:00:00.000123+00:00'
    await updateTask(client, 'group-1', 'task-1', { title: 'Title', assigneeIds: [], labelIds: ['label-1'] }, token)
    expect(String(fetch.mock.calls[0][0])).toContain('/rpc/save_task')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({
      p_group_id: 'group-1', p_task_id: 'task-1', p_changes: { title: 'Title' }, p_assignee_ids: [],
      p_label_ids: ['label-1'], p_expected_updated_at: token,
    })
  })

  it('loads related records in the board query rather than requesting each card', async () => {
    const row = { ...makeTask(), task_assignments: [], task_labels: [] }
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response([row]))
    const tasks = await fetchTasks(clientWith(fetch), 'group-1')
    expect(tasks[0].assignees).toEqual([])
    const url = new URL(String(fetch.mock.calls[0][0]))
    expect(url.searchParams.get('select')).toContain('task_assignments_active_member_fkey')
    expect(url.searchParams.get('group_id')).toBe('eq.group-1')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reconciles a lost create response by reading the stable ID', async () => {
    const task = makeTask({ title: 'Created task' })
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(response([{ ...task, task_assignments: [], task_labels: [] }]))
    const saved = await createTask(clientWith(fetch), 'group-1', {
      title: 'Created task', description: task.description, status: task.status,
      priority: task.priority, due_date: task.due_date,
    }, 'task-1')
    expect(saved.id).toBe('task-1')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][1]?.method).toBe('GET')
  })
})
