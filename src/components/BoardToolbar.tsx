import { Search, SlidersHorizontal, X } from 'lucide-react'
import type { TaskPriority } from '../types/task'

interface BoardToolbarProps {
  query: string
  priority: TaskPriority | 'all'
  onQueryChange: (query: string) => void
  onPriorityChange: (priority: TaskPriority | 'all') => void
  onClear: () => void
}

export function BoardToolbar({
  query,
  priority,
  onQueryChange,
  onPriorityChange,
  onClear,
}: BoardToolbarProps) {
  const hasFilters = Boolean(query.trim()) || priority !== 'all'

  return (
    <div className="board-toolbar" aria-label="Board filters">
      <label className="search-field">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search tasks</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search tasks..."
        />
      </label>

      <label className="select-field compact-select">
        <SlidersHorizontal size={17} aria-hidden="true" />
        <span className="sr-only">Filter by priority</span>
        <select
          value={priority}
          onChange={(event) => onPriorityChange(event.target.value as TaskPriority | 'all')}
        >
          <option value="all">All priorities</option>
          <option value="high">High priority</option>
          <option value="normal">Normal priority</option>
          <option value="low">Low priority</option>
        </select>
      </label>

      {hasFilters && (
        <button className="button button-ghost clear-button" type="button" onClick={onClear}>
          <X size={16} />
          Clear
        </button>
      )}
    </div>
  )
}
