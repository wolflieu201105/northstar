import type { RelationFilter } from '../../../shared/types/filters'
import type { FilterOption } from './types'

export function getFilterOptions<Row extends FilterOption>(rows: Row[], linked: Row[]): Row[] {
  const linkedIds = new Set(linked.map((row) => row.id))
  return [...new Map([...linked, ...rows].map((row) => [row.id, row])).values()]
    .filter((row) => !row.archived_at || linkedIds.has(row.id))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Wait for both tasks and lookups before treating a missing ID as deleted. */
export function resolveFilter(selection: RelationFilter, options: FilterOption[], ready: boolean): RelationFilter {
  if (!Array.isArray(selection) || !ready) return selection
  const known = new Set(options.map((option) => option.id))
  const ids = selection.filter((id) => known.has(id))
  return ids.length ? ids : 'all'
}

export function removeFilterId(selection: RelationFilter, id: string): RelationFilter {
  if (!Array.isArray(selection)) return 'all'
  const ids = selection.filter((value) => value !== id)
  return ids.length ? ids : 'all'
}
