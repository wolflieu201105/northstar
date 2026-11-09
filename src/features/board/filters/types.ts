import type { RelationFilter } from '../../../shared/types/filters'
import type { TaskPriority } from '../../tasks/types'

export interface BoardFilters {
  query: string
  priority: TaskPriority | 'all'
  assignee: RelationFilter
  label: RelationFilter
  setQuery: (query: string) => void
  setPriority: (priority: TaskPriority | 'all') => void
  setAssignee: (value: RelationFilter) => void
  setLabel: (value: RelationFilter) => void
  clearFilters: () => void
}

export interface FilterOption {
  id: string
  name: string
  archived_at: string | null
}
