import type { SupabaseClient } from '@supabase/supabase-js'
import type { Task, TaskInsert, TaskStatus } from '../types/task'

const TASK_COLUMNS =
  'id,title,description,status,priority,due_date,user_id,created_at,updated_at'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function fetchTasks(client: SupabaseClient, userId: string): Promise<Task[]> {
  const { data, error } = await client
    .from('tasks')
    .select(TASK_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Task[]
}

export async function createTask(
  client: SupabaseClient,
  userId: string,
  input: TaskInsert,
): Promise<Task> {
  const { data, error } = await client
    .from('tasks')
    .insert({ ...input, user_id: userId })
    .select(TASK_COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return data as Task
}

export async function updateTask(
  client: SupabaseClient,
  userId: string,
  taskId: string,
  input: Partial<TaskInsert>,
): Promise<Task> {
  const { data, error } = await client
    .from('tasks')
    .update(input)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select(TASK_COLUMNS)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('The task could not be found or you no longer have access to it.')
  return data as Task
}

export async function updateTaskStatus(
  client: SupabaseClient,
  userId: string,
  taskId: string,
  status: TaskStatus,
) {
  return updateTask(client, userId, taskId, { status })
}

export async function deleteTask(client: SupabaseClient, userId: string, taskId: string) {
  const { error } = await client.from('tasks').delete().eq('id', taskId).eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export function friendlyTaskError(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback)
  if (/failed to fetch|network/i.test(message)) {
    return 'We could not reach the task service. Check your connection and try again.'
  }
  return message
}
