import { Search, SlidersHorizontal } from 'lucide-react'
import type { TaskPriority } from '../../tasks/types'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import type { BoardFilters, FilterOption } from '../filters/types'
import { RelationFilter } from './RelationFilter'
import { BoardFilterChips } from './BoardFilterChips'

interface BoardToolbarProps {
  filters: BoardFilters
  members: FilterOption[]
  labels: FilterOption[]
  workspace: ReturnType<typeof useWorkspaceData>
}

export function BoardToolbar({ filters, members, labels, workspace }: BoardToolbarProps) {
  return (
    <div className="board-filter-controls">
      <div className="board-toolbar" role="group" aria-label="Board filters">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search tasks</span>
          <input type="search" value={filters.query} onChange={(event) => filters.setQuery(event.target.value)} placeholder="Search tasks..." />
        </label>

        <label className="select-field compact-select">
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span className="sr-only">Filter by priority</span>
          <select value={filters.priority} onChange={(event) => filters.setPriority(event.target.value as TaskPriority | 'all')}>
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="normal">Normal priority</option>
            <option value="low">Low priority</option>
          </select>
        </label>

        <RelationFilter title="Assignees" emptyLabel="Unassigned" options={members} selection={filters.assignee}
          isLoading={workspace.membersLoading} error={workspace.memberError} onChange={filters.setAssignee} onRetry={workspace.reloadMembers} />
        <RelationFilter title="Labels" emptyLabel="Unlabeled" options={labels} selection={filters.label}
          isLoading={workspace.labelsLoading} error={workspace.labelError} onChange={filters.setLabel} onRetry={workspace.reloadLabels} />
      </div>
      <BoardFilterChips filters={filters} members={members} labels={labels} />
    </div>
  )
}
