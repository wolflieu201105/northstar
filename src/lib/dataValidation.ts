import type { Json } from '../types/database'
import type { TeamMember } from '../types/team'
import type { Label } from '../types/label'
import type { TaskView } from '../types/task'
import { TASK_PRIORITIES, TASK_STATUSES } from '../types/task'
import type { TaskActivity } from '../types/activity'
import type { Tables } from '../types/database'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
const isNullableText = (value: unknown) => value === null || typeof value === 'string'
function isOwnedRow(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && ['id', 'user_id', 'created_at'].every((key) => typeof value[key] === 'string')
}
export function isMember(value: unknown): value is TeamMember {
  return isOwnedRow(value) && typeof value.name === 'string' && typeof value.updated_at === 'string'
    && isNullableText(value.avatar_color) && isNullableText(value.archived_at)
}
export function isLabel(value: unknown): value is Label {
  return isOwnedRow(value) && typeof value.name === 'string' && typeof value.updated_at === 'string'
    && typeof value.color === 'string' && isNullableText(value.archived_at)
}
export function parseTaskView(value: unknown): TaskView {
  if (!isOwnedRow(value) || typeof value.title !== 'string' || typeof value.updated_at !== 'string'
    || !isNullableText(value.description) || !isNullableText(value.due_date)
    || !TASK_STATUSES.some((status) => status === value.status)
    || !TASK_PRIORITIES.some((priority) => priority === value.priority)
    || !Array.isArray(value.assignees) || !value.assignees.every(isMember)
    || !Array.isArray(value.labels) || !value.labels.every(isLabel)) {
    throw new Error('The server returned an invalid task. Reload the board before continuing.')
  }
  return value as unknown as TaskView
}

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
