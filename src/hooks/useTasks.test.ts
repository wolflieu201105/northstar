import { act, renderHook, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTasks } from './useTasks'
import { makeTask } from '../test/fixtures'
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  updateTaskStatus,
} from '../services/tasks'

vi.mock('../services/tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/tasks')>()
  return {
    ...original,
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    updateTaskStatus: vi.fn(),
    deleteTask: vi.fn(),
  }
})

const client = {} as SupabaseClient

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchTasks).mockResolvedValue([makeTask()])
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
})
