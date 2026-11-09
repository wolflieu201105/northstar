import type { TaskActivity } from '../types'
import { STATUS_META } from '../../tasks/types'
import { formatChanges, type ActivityChange } from './formatChanges'

export interface ActivityPresentation { summary: string; context?: string; changes?: ActivityChange[] }

export function formatActivity(event: TaskActivity): ActivityPresentation {
  switch (event.event_type) {
    case 'task_created': return { summary: 'Created this task', context: `“${event.payload.title}” · ${STATUS_META[event.payload.status].label}` }
    case 'status_changed': return { summary: `Moved from ${STATUS_META[event.payload.from].label} → ${STATUS_META[event.payload.to].label}` }
    case 'task_edited': {
      const changes = formatChanges(event.payload.changes)
      const names = changes.map((change) => change.label.toLowerCase())
      const description = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
      return { summary: description ? `Updated ${description}` : 'Updated task details', changes }
    }
    case 'assignee_added': return { summary: `Assigned ${event.payload.assignee_name}` }
    case 'assignee_removed': return { summary: `Unassigned ${event.payload.assignee_name}` }
    case 'label_added': return { summary: `Added label “${event.payload.label_name}”` }
    case 'label_removed': return { summary: `Removed label “${event.payload.label_name}”` }
    default: return { summary: 'Task activity recorded', context: 'Additional details are unavailable.' }
  }
}

