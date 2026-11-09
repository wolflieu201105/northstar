import { act, renderHook, waitFor } from '@testing-library/react'
import type { AppClient } from '../../../shared/lib/supabase'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTasks } from './useTasks'
import { makeTask } from '../../../test/fixtures'
import {
  createTask,
  deleteTask,
  fetchTasks,
  fetchTask,
  updateTask,
  updateTaskStatus,
} from '../services/tasks'

vi.mock('../services/tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/tasks')>()
  return {
    ...original,
    fetchTasks: vi.fn(),
    fetchTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    deleteTask: vi.fn(),
  }
})

const client = {} as AppClient

describe('useTasks', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fetchTasks).mockResolvedValue([makeTask()])
    vi.mocked(fetchTask).mockResolvedValue(makeTask())
  })

  it('loads tasks after a guest identity is available', async () => {
    const { result } = renderHook(() => useTasks(client, 'user-1'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.tasks).toEqual([makeTask()])
    expect(fetchTasks).toHaveBeenCalledWith(client, 'user-1')
  })

  it('adds a saved task to the beginning of the board', async () => {
    const savedTask = makeTask({ id: 'task-2', title: 'New task' })
    vi.mocked(createTask).mockResolvedValue(savedTask)
    const { result } = renderHook(() => useTasks(client, 'user-1'))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => {
      await result.current.addTask({
        title: 'New task',
        description: null,
        status: 'todo',
        priority: 'normal',
        due_date: null,
      })
    })

    expect(result.current.tasks.map((task) => task.id)).toEqual(['task-2', 'task-1'])
  })

  it('rolls an optimistic move back when persistence fails', async () => {
    let rejectMove!: (error: Error) => void
    vi.mocked(updateTaskStatus).mockReturnValue(
      new Promise((_, reject) => {
        rejectMove = reject
      }),
    )
    const { result } = renderHook(() => useTasks(client, 'user-1'))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    act(() => {
      void result.current.moveTask('task-1', 'done')
    })
    await waitFor(() => expect(result.current.tasks[0].status).toBe('done'))

    act(() => rejectMove(new Error('Network unavailable')))
    await waitFor(() => expect(result.current.tasks[0].status).toBe('todo'))
    expect(result.current.notice?.message).toBe(
      'We could not reach the task service. Check your connection and try again.',
    )
    expect(result.current.notice?.retry).toBeTypeOf('function')
  })

  it('delegates edit and delete operations to the task service', async () => {
    const edited = makeTask({ title: 'Updated task' })
    vi.mocked(updateTask).mockResolvedValue(edited)
    vi.mocked(deleteTask).mockResolvedValue(undefined)
    const { result } = renderHook(() => useTasks(client, 'user-1'))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))

    await act(async () => {
      await result.current.editTask('task-1', {
        title: 'Updated task',
        description: null,
        status: 'todo',
        priority: 'normal',
        due_date: null,
      })
    })
    expect(result.current.tasks[0].title).toBe('Updated task')

    await act(async () => {
      await result.current.removeTask('task-1')
    })
    expect(result.current.tasks).toEqual([])
  })

  it('blocks a second move and an edit while the first move is saving', async () => {
    let finish!: (task: ReturnType<typeof makeTask>) => void
    vi.mocked(updateTaskStatus).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useTasks(client, 'user-1'))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    let move!: Promise<void>
    act(() => {
      move = result.current.moveTask('task-1', 'done')
      void result.current.moveTask('task-1', 'in_review')
    })
    await expect(result.current.editTask('task-1', { title: 'Overlap' })).rejects.toThrow('already saving')
    expect(updateTaskStatus).toHaveBeenCalledTimes(1)
    expect(updateTask).not.toHaveBeenCalled()
    await act(async () => { finish(makeTask({ status: 'done' })); await move })
    expect(result.current.tasks[0].status).toBe('done')
  })

  it('passes the exact server timestamp to the atomic save', async () => {
    const token = '2026-11-08T14:00:00.000123+00:00'
    vi.mocked(fetchTasks).mockResolvedValue([makeTask({ updated_at: token })])
    vi.mocked(updateTask).mockResolvedValue(makeTask({ title: 'Changed' }))
    const { result } = renderHook(() => useTasks(client, 'user-1'))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    await act(async () => { await result.current.editTask('task-1', { title: 'Changed' }) })
    expect(updateTask).toHaveBeenCalledWith(client, 'user-1', 'task-1', { title: 'Changed' }, token)
  })

  it('reuses the create ID after an uncertain response', async () => {
    vi.mocked(createTask).mockRejectedValueOnce(new Error('Uncertain outcome'))
      .mockImplementation(async (_client, _owner, _input, id) => makeTask({ id }))
    const { result } = renderHook(() => useTasks(client, 'user-1'))
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    const input = { title: 'Stable create', description: null, status: 'todo' as const, priority: 'normal' as const, due_date: null }
    await act(async () => { await expect(result.current.addTask(input)).rejects.toThrow('Uncertain') })
    await act(async () => { await result.current.addTask(input) })
    expect(vi.mocked(createTask).mock.calls[0][3]).toBe(vi.mocked(createTask).mock.calls[1][3])
  })

  it('does not show data from the previous guest after identity changes', async () => {
    let finishA!: (tasks: ReturnType<typeof makeTask>[]) => void
    vi.mocked(fetchTasks).mockImplementation(async (_client, owner) => owner === 'A'
      ? new Promise((resolve) => { finishA = resolve })
      : [makeTask({ id: 'B-task', user_id: 'B' })])
    const { result, rerender } = renderHook(({ owner }) => useTasks(client, owner), { initialProps: { owner: 'A' } })
    rerender({ owner: 'B' })
    await waitFor(() => expect(result.current.tasks[0]?.id).toBe('B-task'))
    await act(async () => { finishA([makeTask({ id: 'A-task', user_id: 'A' })]) })
    expect(result.current.tasks.map((task) => task.id)).toEqual(['B-task'])
  })

  it('updates assignee presentation from canonical member metadata', async () => {
    const member = { id: 'member-1', user_id: 'user-1', name: 'Alex', avatar_color: null, archived_at: null,
      created_at: '2026-11-08T14:00:00Z', updated_at: '2026-11-08T14:00:00Z' }
    vi.mocked(fetchTasks).mockResolvedValue([makeTask({ assignees: [member] })])
    const { result, rerender } = renderHook(({ name }) => useTasks(client, 'user-1', {
      members: [{ ...member, name }], labels: [],
    }), { initialProps: { name: 'Alex' } })
    await waitFor(() => expect(result.current.tasks).toHaveLength(1))
    rerender({ name: 'Alex Renamed' })
    expect(result.current.tasks[0].assignees[0].name).toBe('Alex Renamed')
    expect(result.current.tasks[0].id).toBe('task-1')
  })
})
