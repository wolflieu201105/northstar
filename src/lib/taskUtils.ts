import type { Task, TaskPriority, TaskStatus } from '../types/task'

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
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 3) return 'upcoming'
  return 'later'
}

export function formatDueDate(value: string) {
  const date = toLocalCalendarDate(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function filterTasks<TaskType extends Task>(tasks: TaskType[], query: string, priority: TaskPriority | 'all') {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  return tasks.filter((task) => {
    const matchesQuery =
      !normalizedQuery ||
      task.title.toLocaleLowerCase().includes(normalizedQuery) ||
      task.description?.toLocaleLowerCase().includes(normalizedQuery)
    const matchesPriority = priority === 'all' || task.priority === priority
    return Boolean(matchesQuery && matchesPriority)
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
