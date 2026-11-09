import type { AppClient } from '../../../shared/lib/supabase'
import type { TimelineCursor } from '../../../shared/types/timeline'
import { cursorFilter, timelinePage, TIMELINE_PAGE_SIZE } from '../../../shared/services/timeline'
import { serviceError, unresolvedMutation } from '../../../shared/services/errors'
import { normalizeCommentBody } from '../utils'

export async function fetchComments(client: AppClient, userId: string, taskId: string, cursor?: TimelineCursor) {
  let query = client.from('comments').select('*').eq('user_id', userId).eq('task_id', taskId)
    .order('created_at').order('id').limit(TIMELINE_PAGE_SIZE + 1)
  if (cursor) query = query.or(cursorFilter(cursor))
  const { data, error } = await query
  if (error) throw serviceError(error)
  return timelinePage(data ?? [])
}
export async function createComment(client: AppClient, userId: string, taskId: string, body: string, id: string = crypto.randomUUID()) {
  const text = normalizeCommentBody(body)
  const { data, error } = await client.from('comments').insert({ id, task_id: taskId, user_id: userId, body: text }).select('*').single()
  if (!error) return data
  const problem = serviceError(error)
  if (problem.uncertain || problem.code === '23505') {
    const { data: saved, error: readError } = await client.from('comments').select('*')
      .eq('user_id', userId).eq('task_id', taskId).eq('id', id).maybeSingle()
    if (!readError && saved && saved.body === text) return saved
    if (problem.uncertain) throw unresolvedMutation()
  }
  throw problem
}
