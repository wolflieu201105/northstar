import type { AppClient } from '../../../shared/lib/supabase'
import { parseActivity } from '../validation'
import type { TimelineCursor } from '../../../shared/types/timeline'
import { cursorFilter, timelinePage, TIMELINE_PAGE_SIZE } from '../../../shared/services/timeline'
import { serviceError } from '../../../shared/services/errors'

export async function fetchActivity(client: AppClient, userId: string, taskId: string, cursor?: TimelineCursor) {
  let query = client.from('task_activity').select('*').eq('user_id', userId).eq('task_id', taskId)
    .order('created_at').order('id').limit(TIMELINE_PAGE_SIZE + 1)
  if (cursor) query = query.or(cursorFilter(cursor))
  const { data, error } = await query
  if (error) throw serviceError(error)
  return timelinePage((data ?? []).map(parseActivity))
}
