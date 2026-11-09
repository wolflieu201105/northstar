import { TASK_PRIORITIES, TASK_STATUSES, type TaskView } from './types'
import { isOwnedRow, isNullableText } from '../../shared/lib/validation'
import { isMember } from '../team/validation'
import { isLabel } from '../labels/validation'

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
