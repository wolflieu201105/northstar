import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { RelationFilter as Selection } from '../../../shared/types/filters'
import type { FilterOption } from '../filters/types'
import { removeFilterId } from '../filters/options'

interface RelationFilterProps {
  title: string
  emptyLabel: string
  options: FilterOption[]
  selection: Selection
  isLoading: boolean
  error: string | null
  onChange: (value: Selection) => void
  onRetry: () => void
}

export function RelationFilter({ title, emptyLabel, options, selection, isLoading, error, onChange, onRetry }: RelationFilterProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const selectedIds = Array.isArray(selection) ? selection : []
  const visibleOptions = options.filter((option) => option.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const description = selection === 'all' ? 'All' : selection === 'none' ? emptyLabel : `${selectedIds.length} selected`
  return <details className="board-relation-filter">
    <summary>{title}<span>{description}</span><ChevronDown size={15} aria-hidden="true" /></summary>
    <fieldset className="board-filter-options">
      <legend className="sr-only">Filter by {title.toLowerCase()}</legend>
      <div className="filter-modes">
        <button type="button" aria-pressed={selection === 'all'} onClick={() => onChange('all')}>All {title.toLowerCase()}</button>
        <button type="button" aria-pressed={selection === 'none'} onClick={() => onChange('none')}>{emptyLabel}</button>
      </div>
      <label className="filter-option-search" htmlFor={`${id}-search`}>
        <span className="sr-only">Search {title.toLowerCase()} filters</span>
        <input id={`${id}-search`} type="search" placeholder={`Find ${title.toLowerCase()}…`} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {isLoading && <p role="status">Loading {title.toLowerCase()}…</p>}
      {error && <div role="alert"><p>{error}</p><button type="button" className="text-button" onClick={onRetry}>Retry {title.toLowerCase()} filters</button></div>}
      <div className="filter-option-list">
        {visibleOptions.map((option) => <label key={option.id}>
          <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={(event) => onChange(event.target.checked ? [...selectedIds, option.id] : removeFilterId(selection, option.id))} />
          <span>{option.name}{option.archived_at ? ' (Archived)' : ''}</span>
        </label>)}
      </div>
      {!isLoading && !error && visibleOptions.length === 0 && <p>{options.length ? 'No matching options.' : `No ${title.toLowerCase()} yet.`}</p>}
      <p>Match any selected {title === 'Assignees' ? 'member' : 'label'}.</p>
    </fieldset>
  </details>
}
