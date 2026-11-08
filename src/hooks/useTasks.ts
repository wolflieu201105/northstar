import { useCallback, useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task, TaskInsert, TaskStatus } from '../types/task'
import {
  createTask as createTaskRequest,
  deleteTask as deleteTaskRequest,
  fetchTasks,
  friendlyTaskError,
  updateTask as updateTaskRequest,
  updateTaskStatus,
} from '../services/tasks'

interface MutationNotice {
  message: string
  retryMove?: { taskId: string; status: TaskStatus }
}

export function useTasks(client: SupabaseClient | null, userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notice, setNotice] = useState<MutationNotice | null>(null)
  const [movingTaskIds, setMovingTaskIds] = useState<Set<string>>(new Set())
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadedRequest, setLoadedRequest] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoadError(null)
    setLoadAttempt((value) => value + 1)
  }, [])

  const requestKey = client && userId ? `${userId}:${loadAttempt}` : null
  const isLoading = requestKey !== null && loadedRequest !== requestKey

  useEffect(() => {
    if (!client || !userId) return

    let active = true
    const activeRequest = `${userId}:${loadAttempt}`

    fetchTasks(client, userId)
      .then((data) => {
        if (active) {
          setTasks(data)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (active) setLoadError(friendlyTaskError(error, 'Tasks could not be loaded.'))
      })
      .finally(() => {
        if (active) setLoadedRequest(activeRequest)
      })

    return () => {
      active = false
    }
  }, [client, loadAttempt, userId])

  const addTask = useCallback(
    async (input: TaskInsert) => {
      if (!client || !userId) throw new Error('Your guest session is not ready yet.')
      const task = await createTaskRequest(client, userId, input)
      setTasks((current) => [task, ...current])
      return task
    },
    [client, userId],
  )

  const editTask = useCallback(
    async (taskId: string, input: TaskInsert) => {
      if (!client || !userId) throw new Error('Your guest session is not ready yet.')
      const task = await updateTaskRequest(client, userId, taskId, input)
      setTasks((current) => current.map((item) => (item.id === task.id ? task : item)))
      return task
    },
    [client, userId],
  )

  const removeTask = useCallback(
    async (taskId: string) => {
      if (!client || !userId) throw new Error('Your guest session is not ready yet.')
      await deleteTaskRequest(client, userId, taskId)
      setTasks((current) => current.filter((task) => task.id !== taskId))
    },
    [client, userId],
  )

  const moveTask = useCallback(
    async (taskId: string, nextStatus: TaskStatus) => {
      if (!client || !userId || movingTaskIds.has(taskId)) return

      const currentTask = tasks.find((task) => task.id === taskId)
      if (!currentTask || currentTask.status === nextStatus) return

      const previousStatus = currentTask.status
      setNotice(null)
      setMovingTaskIds((current) => new Set(current).add(taskId))
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? { ...task, status: nextStatus } : task)),
      )

      try {
        const savedTask = await updateTaskStatus(client, userId, taskId, nextStatus)
        setTasks((current) =>
          current.map((task) => (task.id === savedTask.id ? savedTask : task)),
        )
      } catch (error) {
        setTasks((current) =>
          current.map((task) =>
            task.id === taskId ? { ...task, status: previousStatus } : task,
          ),
        )
        setNotice({
          message: friendlyTaskError(error, 'The task move could not be saved.'),
          retryMove: { taskId, status: nextStatus },
        })
      } finally {
        setMovingTaskIds((current) => {
          const next = new Set(current)
          next.delete(taskId)
          return next
        })
      }
    },
    [client, movingTaskIds, tasks, userId],
  )

  const presentedNotice = notice
    ? {
        message: notice.message,
        retry: notice.retryMove
          ? () => void moveTask(notice.retryMove!.taskId, notice.retryMove!.status)
          : undefined,
      }
    : null

  return {
    tasks,
    isLoading,
    loadError,
    reload,
    addTask,
    editTask,
    removeTask,
    moveTask,
    movingTaskIds,
    notice: presentedNotice,
    dismissNotice: () => setNotice(null),
  }
}
