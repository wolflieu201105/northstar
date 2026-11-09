import type { AppClient } from '../lib/supabase'
import { parseTaskView } from '../lib/dataValidation'
import type { TaskChanges, TaskInsert, TaskStatus, TaskView } from '../types/task'
import { serviceError, ServiceError, unresolvedMutation } from './errors'

const TASK_QUERY = `
  id,title,description,status,priority,due_date,user_id,created_at,updated_at,
  task_assignees(member:team_members!task_assignees_member_owner_fkey(*)),
  task_labels(label:labels!task_labels_label_owner_fkey(*))
` as const

export async function fetchTasks(client: AppClient, userId: string): Promise<TaskView[]> {
  const { data, error } = await client.from('tasks').select(TASK_QUERY).eq('user_id', userId)
    .order('created_at', { ascending: false }).order('id', { ascending: true })
  if (error) throw serviceError(error)
  return (data ?? []).map(({ task_assignees, task_labels, ...row }) => parseTaskView({
    ...row,
    assignees: task_assignees.flatMap((link) => link.member ? [link.member] : []),
    labels: task_labels.flatMap((link) => link.label ? [link.label] : []),
  }))
}

export async function fetchTask(client: AppClient, userId: string, id: string): Promise<TaskView | null> {
  const { data, error } = await client.from('tasks').select(TASK_QUERY).eq('user_id', userId).eq('id', id).maybeSingle()
  if (error) throw serviceError(error)
  if (!data) return null
  const { task_assignees, task_labels, ...row } = data
  return parseTaskView({
    ...row,
    assignees: task_assignees.flatMap((link) => link.member ? [link.member] : []),
    labels: task_labels.flatMap((link) => link.label ? [link.label] : []),
  })
}

function scalarChanges(input: TaskChanges) {
  const { assigneeIds: _assignees, labelIds: _labels, ...fields } = input
  void _assignees
  void _labels
  if (fields.title !== undefined) fields.title = fields.title.trim()
  if (fields.description !== undefined) fields.description = fields.description?.trim() || null
  return fields
}
const sameIds = (left: string[], right: string[]) =>
  [...new Set(left)].sort().join(',') === [...new Set(right)].sort().join(',')

export function taskMatchesInput(task: TaskView, input: TaskChanges) {
  return Object.entries(scalarChanges(input)).filter(([, value]) => value !== undefined)
    .every(([key, value]) => task[key as keyof TaskView] === value)
    && (input.assigneeIds === undefined || sameIds(input.assigneeIds, task.assignees.map((m) => m.id)))
    && (input.labelIds === undefined || sameIds(input.labelIds, task.labels.map((l) => l.id)))
}

async function saveTask(client: AppClient, userId: string, taskId: string, input: TaskChanges, expectedUpdatedAt?: string) {
  const { data, error } = await client.rpc('save_task', {
    p_task_id: taskId,
    p_changes: scalarChanges(input),
    ...(input.assigneeIds !== undefined ? { p_assignee_ids: input.assigneeIds } : {}),
    ...(input.labelIds !== undefined ? { p_label_ids: input.labelIds } : {}),
    ...(expectedUpdatedAt !== undefined ? { p_expected_updated_at: expectedUpdatedAt } : {}),
  })
  if (error) {
    const problem = serviceError(error)
    // A failed HTTP response may follow a committed transaction. Read first;
    // never send a second create with a different ID to guess the outcome.
    if (problem.uncertain || (!expectedUpdatedAt && ['23505', '40001'].includes(problem.code))) {
      try {
        const saved = await fetchTask(client, userId, taskId)
        if (saved && taskMatchesInput(saved, input)) return saved
      } catch {
        throw unresolvedMutation()
      }
      if (problem.uncertain) throw unresolvedMutation()
    }
    throw problem
  }
  const saved = parseTaskView(data)
  if (saved.user_id !== userId) throw new ServiceError('The saved task does not belong to this guest.', '42501')
  return saved
}

export function createTask(client: AppClient, userId: string, input: TaskInsert, taskId: string = crypto.randomUUID()) {
  return saveTask(client, userId, taskId, input)
}
export function updateTask(client: AppClient, userId: string, taskId: string, input: TaskChanges, expectedUpdatedAt: string) {
  return saveTask(client, userId, taskId, input, expectedUpdatedAt)
}
export function updateTaskStatus(client: AppClient, userId: string, taskId: string, status: TaskStatus, expectedUpdatedAt: string) {
  return updateTask(client, userId, taskId, { status }, expectedUpdatedAt)
}
export async function deleteTask(client: AppClient, userId: string, taskId: string) {
  const { error } = await client.from('tasks').delete().eq('id', taskId).eq('user_id', userId)
  if (error) throw serviceError(error)
}
export function friendlyTaskError(error: unknown, fallback: string) {
  return serviceError(error, fallback).message
}
