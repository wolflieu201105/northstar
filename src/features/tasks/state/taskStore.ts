import type { AppClient } from '../../../shared/lib/supabase'
import type { TaskChanges, TaskInsert, TaskStatus, TaskView } from '../types'
import { createTask, deleteTask, fetchTask, fetchTasks, updateTask, updateTaskStatus } from '../services/tasks'
import { ServiceError, serviceError } from '../../../shared/services/errors'
import { observable } from '../../../shared/state/observable'

interface TaskState {
  tasks: TaskView[]
  isLoading: boolean
  loadError: string | null
  pendingIds: Set<string>
  notice: { message: string; retry?: () => void } | null
}

export function createTaskStore(client: AppClient | null, groupId: string | undefined, onAccessError?: () => void) {
  const state = observable<TaskState>({ tasks: [], isLoading: Boolean(client && groupId), loadError: null, pendingIds: new Set(), notice: null })
  const pending = new Set<string>()
  const createIds = new Map<string, string>()
  let active = false
  let hasLoaded = false
  let loadRequest = 0
  let mutationVersion = 0
  function context() {
    if (!active || !client || !groupId) throw new Error('Select an accessible group first.')
    return { client, groupId }
  }
  function upsert(task: TaskView) {
    if (!active) return
    state.update((previous) => ({ ...previous, tasks: previous.tasks.some((item) => item.id === task.id)
      ? previous.tasks.map((item) => item.id === task.id ? task : item) : [task, ...previous.tasks] }))
  }
  function acquire(id: string) {
    if (pending.has(id)) throw new ServiceError('This task is already saving. Please wait.', 'BUSY')
    pending.add(id)
    ++mutationVersion
    state.update({ pendingIds: new Set(pending) })
  }
  function release(id: string) {
    pending.delete(id)
    ++mutationVersion
    state.update({ pendingIds: new Set(pending) })
  }
  async function reload(background = false) {
    if (!client || !groupId || !active) return
    const request = ++loadRequest
    const version = mutationVersion
    state.update({ isLoading: !background || !hasLoaded, loadError: null })
    try {
      const rows = await fetchTasks(client, groupId)
      if (!active || request !== loadRequest) return
      if (version !== mutationVersion) { void reload(background); return }
      hasLoaded = true
      const current = state.getSnapshot().tasks
      state.update({ tasks: [
        ...rows.map((row) => pending.has(row.id) ? current.find((task) => task.id === row.id) ?? row : row),
        ...current.filter((row) => pending.has(row.id) && !rows.some((item) => item.id === row.id)),
      ], isLoading: false })
    } catch (error) {
      if (active && request === loadRequest && serviceError(error).code === '42501') onAccessError?.()
      if (active && request === loadRequest) state.update({ loadError: serviceError(error).message, isLoading: false })
    }
  }
  async function reconcile(id: string) {
    if (!active || !client || !groupId) return
    try {
      const row = await fetchTask(client, groupId, id)
      if (!active) return
      if (row) upsert(row)
      else state.update((previous) => ({ ...previous, tasks: previous.tasks.filter((task) => task.id !== id) }))
    } catch { /* Keep the last known state and let the visible error offer recovery. */ }
  }
  async function addTask(input: TaskInsert) {
    const connection = context()
    const key = JSON.stringify(input)
    const id = createIds.get(key) ?? crypto.randomUUID()
    createIds.set(key, id)
    acquire(id)
    try {
      const task = await createTask(connection.client, connection.groupId, input, id)
      upsert(task)
      createIds.delete(key)
      return task
    } catch (error) {
      if (active && serviceError(error).code === '42501') onAccessError?.()
      throw error
    } finally { release(id) }
  }
  async function editTask(id: string, input: TaskChanges, expectedUpdatedAt?: string) {
    const connection = context()
    const current = state.getSnapshot().tasks.find((task) => task.id === id)
    if (!current) throw new Error('This task is no longer available.')
    acquire(id)
    try {
      const task = await updateTask(connection.client, connection.groupId, id, input, expectedUpdatedAt ?? current.updated_at)
      upsert(task)
      return task
    } catch (reason) {
      const error = serviceError(reason)
      if (active && error.code === '42501') onAccessError?.()
      if (error.code === '40001' || error.uncertain) await reconcile(id)
      throw error
    } finally { release(id) }
  }
  async function removeTask(id: string) {
    const connection = context()
    const current = state.getSnapshot().tasks.find((task) => task.id === id)
    if (!current) throw new Error('This task is no longer available.')
    acquire(id)
    try {
      await deleteTask(connection.client, connection.groupId, id, current.updated_at)
      state.update((previous) => ({ ...previous, tasks: previous.tasks.filter((task) => task.id !== id) }))
    } catch (reason) {
      const error = serviceError(reason)
      if (active && error.code === '42501') onAccessError?.()
      if (error.code === '40001' || error.uncertain) await reconcile(id)
      throw error
    } finally { release(id) }
  }
  async function moveTask(id: string, status: TaskStatus) {
    if (pending.has(id)) return
    const connection = context()
    const current = state.getSnapshot().tasks.find((task) => task.id === id)
    if (!current || current.status === status) return
    acquire(id)
    state.update({ notice: null })
    upsert({ ...current, status })
    try {
      upsert(await updateTaskStatus(connection.client, connection.groupId, id, status, current.updated_at))
    } catch (reason) {
      upsert(current)
      const error = serviceError(reason)
      if (active && error.code === '42501') onAccessError?.()
      if (error.code === '40001' || error.uncertain) await reconcile(id)
      if (active) state.update({ notice: { message: error.message, retry: () => { void moveTask(id, status) } } })
    } finally { release(id) }
  }
  return {
    ...state, reload: () => reload(), refresh: () => reload(true), addTask, editTask, removeTask, moveTask,
    start() { active = true; void reload() },
    stop() { active = false; ++loadRequest },
    dismissNotice() { state.update({ notice: null }) },
  }
}
