import { describe, expect, it } from 'vitest'
import { makeLabel } from '../../../test/fixtures'
import { getFilterOptions, resolveFilter } from './options'

describe('relationship filter options', () => {
  it('includes active options and archived options still linked to tasks, using current names', () => {
    const active = makeLabel()
    const linked = makeLabel({ id: 'linked', name: 'Old name', archived_at: '2026-11-09T00:00:00Z' })
    const unlinked = makeLabel({ id: 'unlinked', archived_at: '2026-11-09T00:00:00Z' })
    expect(getFilterOptions([active, { ...linked, name: 'New name' }, unlinked], [linked, linked]))
      .toEqual([active, { ...linked, name: 'New name' }])
  })

  it('waits for successful lookup/task reads, then ignores unknown/deleted selections', () => {
    const labels = [makeLabel()]
    expect(resolveFilter(['label-1', 'deleted'], [], false)).toEqual(['label-1', 'deleted'])
    expect(resolveFilter(['label-1', 'deleted'], labels, true)).toEqual(['label-1'])
    expect(resolveFilter(['deleted'], labels, true)).toBe('all')
    expect(resolveFilter('none', labels, true)).toBe('none')
  })
})
