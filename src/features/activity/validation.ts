import type { Json, Tables } from '../../shared/types/database'
import type { TaskActivity } from './types'
import { TASK_STATUSES } from '../tasks/types'
import { isRecord, isNullableText } from '../../shared/lib/validation'

export function parseActivity(row: Tables<'task_activity'>): TaskActivity {
  const p = row.payload
  const known = isRecord(p) && p.version === 1 && (
    (row.event_type === 'task_created' && typeof p.title === 'string' && TASK_STATUSES.some((s) => s === p.status))
    || (row.event_type === 'status_changed' && TASK_STATUSES.some((s) => s === p.from) && TASK_STATUSES.some((s) => s === p.to))
    || (row.event_type === 'task_edited' && isRecord(p.changes) && Object.values(p.changes).every((c) => isRecord(c) && 'from' in c && 'to' in c))
    || (['assignee_added', 'assignee_removed'].includes(row.event_type) && typeof p.member_id === 'string' && typeof p.member_name === 'string' && isNullableText(p.avatar_color))
    || (['label_added', 'label_removed'].includes(row.event_type) && typeof p.label_id === 'string' && typeof p.label_name === 'string' && isNullableText(p.color))
  )
  return known ? row as TaskActivity : { ...row, event_type: 'unknown', originalEventType: row.event_type, payload: p as Json }
}
