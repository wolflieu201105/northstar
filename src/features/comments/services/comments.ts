import type { AppClient } from '../../../shared/lib/supabase'
import type { TaskComment } from '../types'
import type { TimelineCursor } from '../../../shared/types/timeline'
import { cursorFilter, timelinePage, TIMELINE_PAGE_SIZE } from '../../../shared/services/timeline'
import { serviceError, unresolvedMutation } from '../../../shared/services/errors'
import { isRecord } from '../../../shared/lib/validation'
import { normalizeCommentBody } from '../utils'

export async function fetchComments(client: AppClient, groupId: string, taskId: string, cursor?: TimelineCursor) {
  let query = client.from('comments').select('*').eq('group_id', groupId).eq('task_id', taskId)
    .order('created_at').order('id').limit(TIMELINE_PAGE_SIZE + 1)
  if (cursor) query = query.or(cursorFilter(cursor))
  const { data, error } = await query
  if (error) throw serviceError(error)
  return timelinePage(data ?? [])
}
export async function fetchRecentComments(client: AppClient, groupId: string, taskId: string) {
  const { data, error } = await client.from('comments').select('*').eq('group_id', groupId).eq('task_id', taskId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(TIMELINE_PAGE_SIZE)
  if (error) throw serviceError(error)
  return (data ?? []).reverse()
}
export async function createComment(client: AppClient, groupId: string, taskId: string, body: string, id: string = crypto.randomUUID(), authorId?: string) {
  const text = normalizeCommentBody(body)
  const { data, error } = await client.rpc('post_comment', { p_group_id: groupId, p_task_id: taskId, p_body: text, p_comment_id: id })
  if (error) {
    const problem = serviceError(error)
    if (problem.uncertain || problem.code === '23505') {
      const { data: saved, error: readError } = await client.from('comments').select('*')
        .eq('group_id', groupId).eq('task_id', taskId).eq('id', id).maybeSingle()
      if (!readError && saved && saved.body === text && (!authorId || saved.author_user_id === authorId)) return saved
      if (problem.uncertain) throw unresolvedMutation()
    }
    throw problem
  }
  if (!isRecord(data) || data.id !== id || data.group_id !== groupId || data.task_id !== taskId || typeof data.author_name !== 'string' || data.body !== text || (authorId && data.author_user_id !== authorId)) throw new Error('Invalid comment response. Refresh comments before retrying.')
  return data as TaskComment
}
