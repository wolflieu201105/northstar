import type { Json, Tables } from '../../shared/types/database'
import type { TaskStatus } from '../tasks/types'

type ActivityBase = Omit<Tables<'task_activity'>, 'event_type' | 'payload'>
type Versioned = { version: 2 }
export type TaskActivity = ActivityBase & (
  | { event_type: 'task_created'; payload: Versioned & { title: string; status: TaskStatus } }
  | { event_type: 'status_changed'; payload: Versioned & { from: TaskStatus; to: TaskStatus } }
  | { event_type: 'task_edited'; payload: Versioned & { changes: Record<string, { from: Json; to: Json }> } }
  | { event_type: 'assignee_added' | 'assignee_removed'; payload: Versioned & { assignee_user_id: string; assignee_name: string; avatar_color: string | null } }
  | { event_type: 'label_added' | 'label_removed'; payload: Versioned & { label_id: string; label_name: string; color: string | null } }
  | { event_type: 'unknown'; originalEventType: string; payload: Json }
)
