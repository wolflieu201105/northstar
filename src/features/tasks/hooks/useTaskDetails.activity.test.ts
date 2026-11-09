import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import { makeActivity, makeLabel, makeMember, makeTask } from '../../../test/fixtures'
import { fetchActivity } from '../../activity/services/activity'
import { fetchComments } from '../../comments/services/comments'
import { fetchTasks, fetchTask, updateTask, updateTaskStatus } from '../services/tasks'
import type { TaskChanges } from '../types'
import type { TaskActivity } from '../../activity/types'
import { useTaskDetails } from './useTaskDetails'
import { useTasks } from './useTasks'

vi.mock('../../activity/services/activity', () => ({ fetchActivity: vi.fn() }))
vi.mock('../../comments/services/comments', () => ({ fetchComments: vi.fn(), createComment: vi.fn() }))
vi.mock('../services/tasks', () => ({ fetchTasks: vi.fn(), fetchTask: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), updateTaskStatus: vi.fn(), deleteTask: vi.fn() }))
const client = {} as AppClient
const task = makeTask()
const created = makeActivity()
const changed = makeActivity({ id: '00000000-0000-4000-8000-000000000002', created_at: '2026-11-09T05:00:00.000002Z' })
const revision = '2026-11-09T05:00:00.000124+00:00'
function useSelectedTask() {
  const tasks = useTasks(client, 'user-1')
  const selected = tasks.tasks.find((row) => row.id === task.id)
  const details = useTaskDetails(client, 'user-1', selected?.id ?? null, selected?.updated_at)
  return { tasks, details }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchTasks).mockResolvedValue([task])
  vi.mocked(fetchTask).mockResolvedValue(task)
  vi.mocked(fetchComments).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(fetchActivity).mockResolvedValue({ items: [created], nextCursor: null })
})

describe('task activity synchronization', () => {
  it.each([
    { name: 'fields', input: { title: 'Changed title' } },
    { name: 'assignments', input: { assigneeIds: ['member-1'] } },
    { name: 'labels', input: { labelIds: ['label-1'] } },
  ])('refetches authoritative history after committed $name changes', async ({ input }) => {
    const changes: TaskChanges = input
    const saved = { ...task, updated_at: revision, title: changes.title ?? task.title,
      assignees: changes.assigneeIds ? [makeMember()] : [], labels: changes.labelIds ? [makeLabel()] : [] }
    vi.mocked(updateTask).mockResolvedValue(saved)
    const { result } = renderHook(useSelectedTask)
    await waitFor(() => expect(result.current.details.activity.items).toEqual([created]))
    vi.mocked(fetchActivity).mockResolvedValue({ items: [created, changed], nextCursor: null })
    await act(async () => { await result.current.tasks.editTask(task.id, changes) })
    await waitFor(() => expect(result.current.details.activity.items).toEqual([created, changed]))
    expect(fetchActivity).toHaveBeenCalledTimes(2)
    expect(updateTask).toHaveBeenCalledWith(client, 'user-1', task.id, changes, task.updated_at)
  })

  it('waits for a status commit and never appends a success event for an optimistic rollback', async () => {
    let fail!: (error: Error) => void
    vi.mocked(updateTaskStatus).mockReturnValueOnce(new Promise((_, reject) => { fail = reject }))
      .mockResolvedValueOnce({ ...task, status: 'in_progress', updated_at: revision })
    const { result } = renderHook(useSelectedTask)
    await waitFor(() => expect(result.current.details.activity.items).toEqual([created]))
    let pending!: Promise<void>
    act(() => { pending = result.current.tasks.moveTask(task.id, 'in_progress') })
    expect(result.current.tasks.tasks[0].status).toBe('in_progress')
    expect(fetchActivity).toHaveBeenCalledOnce()
    await act(async () => { fail(new Error('Network unavailable')); await pending })
    expect(result.current.tasks.tasks[0].status).toBe('todo')
    expect(result.current.details.activity.items).toEqual([created])
    expect(fetchActivity).toHaveBeenCalledOnce()
    vi.mocked(fetchActivity).mockResolvedValue({ items: [created, changed], nextCursor: null })
    await act(async () => { await result.current.tasks.moveTask(task.id, 'in_progress') })
    await waitFor(() => expect(result.current.details.activity.items).toEqual([created, changed]))
    expect(fetchActivity).toHaveBeenCalledTimes(2)
  })

  it('keeps history unchanged for no-op or rejected metadata saves', async () => {
    vi.mocked(updateTask).mockResolvedValueOnce(task).mockRejectedValueOnce(new Error('Rejected edit'))
    const { result } = renderHook(useSelectedTask)
    await waitFor(() => expect(result.current.details.activity.items).toEqual([created]))
    await act(async () => { await result.current.tasks.editTask(task.id, { title: task.title }) })
    await act(async () => { await expect(result.current.tasks.editTask(task.id, { title: 'Rejected' })).rejects.toThrow('Rejected edit') })
    expect(result.current.details.activity.items).toEqual([created])
    expect(fetchActivity).toHaveBeenCalledOnce()
  })

  it('retries a failed activity page at the same cursor and deduplicates in precise order', async () => {
    const third = makeActivity({ id: '00000000-0000-4000-8000-000000000003', created_at: changed.created_at })
    const cursor = { id: created.id, createdAt: created.created_at }
    vi.mocked(fetchActivity).mockResolvedValueOnce({ items: [created], nextCursor: cursor })
      .mockRejectedValueOnce(new Error('Page failed'))
      .mockResolvedValueOnce({ items: [third, created, changed], nextCursor: null })
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', task.id))
    await waitFor(() => expect(result.current.activity.isLoading).toBe(false))
    await act(async () => { await result.current.loadMoreActivity() })
    expect(result.current.activity.items).toEqual([created])
    expect(result.current.activity.failedLoadMore).toBe(true)
    await act(async () => { await result.current.retryActivity() })
    expect(fetchActivity).toHaveBeenNthCalledWith(3, client, 'user-1', task.id, cursor)
    expect(result.current.activity.items).toEqual([created, changed, third])
    expect(result.current.activity.nextCursor).toBeNull()
  })

  it('ignores an old page when a committed revision starts a newer refresh', async () => {
    let finishPage!: (page: { items: TaskActivity[]; nextCursor: null }) => void
    const cursor = { id: created.id, createdAt: created.created_at }
    vi.mocked(fetchActivity).mockResolvedValueOnce({ items: [created], nextCursor: cursor })
      .mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve }))
      .mockResolvedValueOnce({ items: [created], nextCursor: cursor })
    const { result, rerender } = renderHook(({ token }) => useTaskDetails(client, 'user-1', task.id, token), { initialProps: { token: task.updated_at } })
    await waitFor(() => expect(result.current.activity.isLoading).toBe(false))
    let pending!: Promise<void>
    act(() => { pending = result.current.loadMoreActivity() })
    rerender({ token: revision })
    await waitFor(() => expect(result.current.activity.isLoading).toBe(false))
    await act(async () => { finishPage({ items: [changed], nextCursor: null }); await pending })
    expect(result.current.activity.items).toEqual([created])
    expect(result.current.activity.nextCursor).toEqual(cursor)
    expect(fetchActivity).toHaveBeenCalledTimes(3)
  })
})
