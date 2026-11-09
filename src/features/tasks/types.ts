import type { Label } from '../labels/types'
import type { TeamMember } from '../team/types'

export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'done'] as const
export const TASK_PRIORITIES = ['low', 'normal', 'high'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  user_id: string
  created_at: string
  updated_at: string
}

export interface TaskDraft {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
}

export interface TaskView extends Task {
  assignees: TeamMember[]
  labels: Label[]
}

export interface TaskRelationsInput {
  assigneeIds?: string[]
  labelIds?: string[]
}

export type TaskChanges = Partial<TaskInsert> & TaskRelationsInput

export interface TaskInsert extends TaskRelationsInput {
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
}

export const STATUS_META: Record<
  TaskStatus,
  { label: string; shortLabel: string; description: string }
> = {
  todo: {
    label: 'To do',
    shortLabel: 'To do',
    description: 'Ideas and work ready to begin',
  },
  in_progress: {
    label: 'In progress',
    shortLabel: 'In progress',
    description: 'Work that is actively moving',
  },
  in_review: {
    label: 'In review',
    shortLabel: 'Review',
    description: 'Ready for feedback and approval',
  },
  done: {
    label: 'Done',
    shortLabel: 'Done',
    description: 'Completed work worth celebrating',
  },
}

export const EMPTY_TASK_DRAFT: TaskDraft = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'normal',
  due_date: '',
}
