import type { AppClient } from '../../../shared/lib/supabase'
import { parseTaskView } from '../validation'
import type { TaskChanges, TaskInsert, TaskStatus, TaskView } from '../types'
import { serviceError, ServiceError, unresolvedMutation } from '../../../shared/services/errors'

const TASK_QUERY = `
  id,title,description,status,priority,due_date,group_id,created_by_user_id,created_by_name,created_at,updated_at,
  task_assignments(member:group_members!task_assignments_active_member_fkey(profile:profiles!group_members_user_id_fkey(id,username,display_name,avatar_color))),
  task_labels(label:labels!task_labels_label_fkey(*))
` as const

export async function fetchTasks(client: AppClient, groupId: string): Promise<TaskView[]> {
  const { data, error } = await client.from('tasks').select(TASK_QUERY).eq('group_id', groupId)
    .order('created_at', { ascending: false }).order('id', { ascending: true })
  if (error) throw serviceError(error)
  return (data ?? []).map(({ task_assignments, task_labels, ...row }) => parseTaskView({
    ...row,
    assignees: task_assignments.flatMap((link) => link.member?.profile ? [link.member.profile] : []),
    labels: task_labels.flatMap((link) => link.label ? [link.label] : []),
  }))
}

export async function fetchTask(client: AppClient, groupId: string, id: string): Promise<TaskView | null> {
  const { data, error } = await client.from('tasks').select(TASK_QUERY).eq('group_id', groupId).eq('id', id).maybeSingle()
  if (error) throw serviceError(error)
  if (!data) return null
  const { task_assignments, task_labels, ...row } = data
  return parseTaskView({
    ...row,
    assignees: task_assignments.flatMap((link) => link.member?.profile ? [link.member.profile] : []),
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

async function saveTask(client: AppClient, groupId: string, taskId: string, input: TaskChanges, expectedUpdatedAt?: string) {
  const { data, error } = await client.rpc('save_task', {
    p_group_id: groupId,
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
        const saved = await fetchTask(client, groupId, taskId)
        if (saved && taskMatchesInput(saved, input)) return saved
      } catch {
        throw unresolvedMutation()
      }
      if (problem.uncertain) throw unresolvedMutation()
    }
    throw problem
  }
  const saved = parseTaskView(data)
  if (saved.group_id !== groupId) throw new ServiceError('The saved task does not belong to this group.', '42501')
  return saved
}

export function createTask(client: AppClient, groupId: string, input: TaskInsert, taskId: string = crypto.randomUUID()) {
  return saveTask(client, groupId, taskId, input)
}
export function updateTask(client: AppClient, groupId: string, taskId: string, input: TaskChanges, expectedUpdatedAt: string) {
  return saveTask(client, groupId, taskId, input, expectedUpdatedAt)
}
export function updateTaskStatus(client: AppClient, groupId: string, taskId: string, status: TaskStatus, expectedUpdatedAt: string) {
  return updateTask(client, groupId, taskId, { status }, expectedUpdatedAt)
}
export async function deleteTask(client: AppClient, groupId: string, taskId: string, expectedUpdatedAt: string) {
  const { error } = await client.rpc('delete_task', { p_group_id: groupId, p_task_id: taskId, p_expected_updated_at: expectedUpdatedAt })
  if (error) throw serviceError(error)
}
export function friendlyTaskError(error: unknown, fallback: string) {
  return serviceError(error, fallback).message
}
