import type { Task, TaskPriority, TaskStatus } from './types'
import type { RelationFilter } from '../../shared/types/filters'

export type DueState = 'overdue' | 'today' | 'upcoming' | 'later' | null

const toLocalCalendarDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function getDueState(
  dueDate: string | null,
  status: TaskStatus,
  now = new Date(),
): DueState {
  if (!dueDate || status === 'done') return null

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = toLocalCalendarDate(dueDate)
  // Compare calendar ordinals so 23/25-hour daylight-saving days count as one day.
  const days = (Date.UTC(due.getFullYear(), due.getMonth(), due.getDate()) -
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000

  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 3) return 'upcoming'
  return 'later'
}

export function formatDueDate(value: string) {
  const date = toLocalCalendarDate(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

interface FilterableTask extends Task {
  assignees?: { id: string }[]
  labels?: { id: string }[]
}

function matchesRelation(rows: { id: string }[] = [], selection: RelationFilter = 'all') {
  if (selection === 'all' || Array.isArray(selection) && selection.length === 0) return true
  if (selection === 'none') return rows.length === 0
  return rows.some((row) => selection.includes(row.id))
}

export function filterTasks<TaskType extends FilterableTask>(
  tasks: TaskType[], query: string, priority: TaskPriority | 'all',
  relations: { assignee?: RelationFilter; label?: RelationFilter } = {},
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return tasks.filter((task) => {
    const matchesQuery =
      !normalizedQuery ||
      task.title.toLocaleLowerCase().includes(normalizedQuery) ||
      task.description?.toLocaleLowerCase().includes(normalizedQuery)
    const matchesPriority = priority === 'all' || task.priority === priority
    return Boolean(matchesQuery && matchesPriority &&
      matchesRelation(task.assignees, relations.assignee) && matchesRelation(task.labels, relations.label))
  })
}

export function getBoardSummary(tasks: Task[], now = new Date()) {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === 'done').length,
    overdue: tasks.filter((task) => getDueState(task.due_date, task.status, now) === 'overdue')
      .length,
  }
}

export function toTaskInsert(draft: {
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string
}) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    status: draft.status,
    priority: draft.priority,
    due_date: draft.due_date || null,
  }
}
