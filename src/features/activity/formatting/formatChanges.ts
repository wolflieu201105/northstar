import type { Json } from '../../../shared/types/database'
import { TASK_PRIORITIES } from '../../tasks/types'

export interface ActivityChange { field: string; label: string; from: string; to: string }
const fields = ['title', 'description', 'priority', 'due_date'] as const
const fieldNames = { title: 'Title', description: 'Description', priority: 'Priority', due_date: 'Due date' }

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00`)
  if (!Number.isFinite(date.getTime())) return null
  const parts = value.split('-').map(Number)
  if (date.getFullYear() !== parts[0] || date.getMonth() + 1 !== parts[1] || date.getDate() !== parts[2]) return null
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
function fieldValue(field: typeof fields[number], value: Json) {
  if (field === 'due_date') return value === null ? 'No due date' : typeof value === 'string' ? calendarDate(value) : null
  if (field === 'priority') return typeof value === 'string' && TASK_PRIORITIES.some((priority) => priority === value)
    ? value[0].toUpperCase() + value.slice(1) : null
  if (field === 'description' && (value === null || value === '')) return 'No description'
  return typeof value === 'string' ? value : null
}

export function formatChanges(changes: Record<string, { from: Json; to: Json }>): ActivityChange[] {
  return fields.flatMap((field) => {
    if (!Object.hasOwn(changes, field)) return []
    const from = fieldValue(field, changes[field].from)
    const to = fieldValue(field, changes[field].to)
    return from === null || to === null ? [] : [{ field, label: fieldNames[field], from, to }]
  })
}
