import { useId, useState } from 'react'

interface RelationOption { id: string; name: string; color: string | null; archived_at: string | null }
interface TaskRelationPickerProps {
  title: string
  options: RelationOption[]
  selectedIds: string[]
  isLoading: boolean
  error: string | null
  onChange: (ids: string[]) => void
  onRetry: () => void
  onManage?: () => void
  manageLabel?: string
  emptySelectionLabel?: string
  unavailableLabel?: string
}

export function TaskRelationPicker({ title, options, selectedIds, isLoading, error, onChange, onRetry, onManage, manageLabel, emptySelectionLabel = 'None selected', unavailableLabel = 'Archived' }: TaskRelationPickerProps) {
  const id = useId()
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleOptions = options.filter((option) => !normalizedQuery || option.name.toLocaleLowerCase().includes(normalizedQuery))
  return <fieldset className="relation-picker">
    <legend>{title}</legend>
    <div className="relation-picker-heading"><span>{selectedIds.length ? `${selectedIds.length} selected` : emptySelectionLabel}</span>
      {onManage && <button className="text-button" type="button" onClick={onManage}>{manageLabel ?? `Manage ${title.toLowerCase()}`}</button>}</div>
    {(options.length > 8 || query) && <label className="form-field relation-search" htmlFor={`${id}-search`}>
      <span className="sr-only">Search {title.toLowerCase()}</span>
      <input id={`${id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}…`} />
    </label>}
    {isLoading && <p className="detail-hint" role="status">Loading {title.toLowerCase()}…</p>}
    {error && <div className="form-error" role="alert"><p>{error}</p><button className="text-button" type="button" onClick={onRetry}>Retry {title.toLowerCase()}</button></div>}
    {!isLoading && !error && options.length === 0 && <p className="detail-hint">No {title.toLowerCase()} yet.</p>}
    <div className="relation-options">
      {visibleOptions.map((option) => {
        const checked = selectedIds.includes(option.id)
        return <label key={option.id} className={`relation-option${checked ? ' is-selected' : ''}`} htmlFor={`${id}-${option.id}`}>
          <input id={`${id}-${option.id}`} type="checkbox" checked={checked} disabled={Boolean(option.archived_at) && !checked}
            onChange={() => onChange(checked ? selectedIds.filter((selected) => selected !== option.id) : [...selectedIds, option.id])} />
          <span className="color-dot" style={{ backgroundColor: option.color ?? 'var(--accent)' }} aria-hidden="true" />
          <span>{option.name}{option.archived_at ? ` (${unavailableLabel})` : ''}</span>
        </label>
      })}
    </div>
    {options.length > 0 && visibleOptions.length === 0 && <p className="detail-hint">No matching {title.toLowerCase()}.</p>}
  </fieldset>
}
