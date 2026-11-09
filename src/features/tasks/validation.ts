import { TASK_PRIORITIES, TASK_STATUSES, type TaskView } from './types'
import { isGroupRow, isNullableText } from '../../shared/lib/validation'
import { isMember } from '../team/validation'
import { isLabel } from '../labels/validation'

export function parseTaskView(value: unknown): TaskView {
  if (!isGroupRow(value) || typeof value.title !== 'string' || typeof value.updated_at !== 'string'
    || typeof value.created_by_name !== 'string' || !isNullableText(value.created_by_user_id)
    || !isNullableText(value.description) || !isNullableText(value.due_date)
    || !TASK_STATUSES.some((status) => status === value.status)
    || !TASK_PRIORITIES.some((priority) => priority === value.priority)
    || !Array.isArray(value.assignees) || !value.assignees.every(isMember)
    || !Array.isArray(value.labels) || !value.labels.every((label) => isLabel(label) && label.group_id === value.group_id)) {
    throw new Error('The server returned an invalid task. Reload the board before continuing.')
  }
  const task = value as unknown as TaskView
  return { ...task,
    assignees: [...new Map(task.assignees.map((member) => [member.id, member])).values()],
    labels: [...new Map(task.labels.map((label) => [label.id, label])).values()],
  }
}
