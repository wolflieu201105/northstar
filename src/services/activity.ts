import type { AppClient } from '../lib/supabase'
import { parseActivity } from '../lib/dataValidation'
import type { TimelineCursor } from '../types/comment'
import { cursorFilter, timelinePage, TIMELINE_PAGE_SIZE } from './timeline'
import { serviceError } from './errors'

export async function fetchActivity(client: AppClient, userId: string, taskId: string, cursor?: TimelineCursor) {
  let query = client.from('task_activity').select('*').eq('user_id', userId).eq('task_id', taskId)
    .order('created_at').order('id').limit(TIMELINE_PAGE_SIZE + 1)
  if (cursor) query = query.or(cursorFilter(cursor))
  const { data, error } = await query
  if (error) throw serviceError(error)
  return timelinePage((data ?? []).map(parseActivity))
}
