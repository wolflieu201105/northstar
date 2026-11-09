import type { TaskActivity } from './types'
import { STATUS_META } from '../tasks/types'

const fieldNames: Record<string, string> = { title: 'title', description: 'description', priority: 'priority', due_date: 'due date' }
export function activityDescription(event: TaskActivity) {
  switch (event.event_type) {
    case 'task_created': return `Created “${event.payload.title}”`
    case 'status_changed': return `Moved from ${STATUS_META[event.payload.from].label} → ${STATUS_META[event.payload.to].label}`
    case 'task_edited': return `Updated ${Object.keys(event.payload.changes).map((field) => fieldNames[field] ?? field).join(', ')}`
    case 'assignee_added': return `Assigned ${event.payload.member_name}`
    case 'assignee_removed': return `Unassigned ${event.payload.member_name}`
    case 'label_added': return `Added label “${event.payload.label_name}”`
    case 'label_removed': return `Removed label “${event.payload.label_name}”`
    default: return 'Task activity recorded'
  }
}

