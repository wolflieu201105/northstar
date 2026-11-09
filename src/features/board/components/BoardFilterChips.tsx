import { X } from 'lucide-react'
import type { RelationFilter } from '../../../shared/types/filters'
import type { BoardFilters, FilterOption } from '../filters/types'
import { removeFilterId } from '../filters/options'

interface FilterChip { key: string; text: string; remove: () => void }

function relationChips(selection: RelationFilter, options: FilterOption[], title: string, emptyLabel: string, onChange: (value: RelationFilter) => void): FilterChip[] {
  if (selection === 'all') return []
  if (selection === 'none') return [{ key: title, text: emptyLabel, remove: () => onChange('all') }]
  return selection.map((id) => {
    const option = options.find((row) => row.id === id)
    return {
      key: `${title}-${id}`,
      text: `${title}: ${option ? `${option.name}${option.archived_at ? ' (Archived)' : ''}` : 'unavailable'}`,
      remove: () => onChange(removeFilterId(selection, id)),
    }
  })
}

export function BoardFilterChips({ filters, members, labels }: { filters: BoardFilters; members: FilterOption[]; labels: FilterOption[] }) {
  const chips: FilterChip[] = [
    ...(filters.query.trim() ? [{ key: 'query', text: `Search: ${filters.query.trim()}`, remove: () => filters.setQuery('') }] : []),
    ...(filters.priority !== 'all' ? [{ key: 'priority', text: `Priority: ${filters.priority}`, remove: () => filters.setPriority('all') }] : []),
    ...relationChips(filters.assignee, members, 'Assignee', 'Unassigned', filters.setAssignee),
    ...relationChips(filters.label, labels, 'Label', 'Unlabeled', filters.setLabel),
  ]
  if (chips.length === 0) return null
  return <div className="active-board-filters" role="group" aria-label="Active filters">
    {chips.map((chip) => <button className="board-filter-chip" key={chip.key} type="button" onClick={chip.remove} aria-label={`Remove ${chip.text} filter`}>
      <span>{chip.text}</span><X size={13} aria-hidden="true" />
    </button>)}
    <button className="button button-ghost clear-button" type="button" onClick={filters.clearFilters}>Clear filters</button>
  </div>
}
