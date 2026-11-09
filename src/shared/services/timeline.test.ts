import { describe, expect, it } from 'vitest'
import { cursorFilter, timelinePage } from './timeline'

describe('timeline contracts', () => {
  it('uses a timestamp and ID cursor with an extra row to detect more results', () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({ id: String(index), created_at: '2026-11-08T14:00:00.000123Z' }))
    const page = timelinePage(rows)
    expect(page.items).toHaveLength(50)
    expect(page.nextCursor).toEqual({ createdAt: rows[49].created_at, id: '49' })
    expect(timelinePage(rows.slice(0, 50)).nextCursor).toBeNull()
  })
  it('rejects unsafe raw-filter cursor values', () => {
    expect(() => cursorFilter({ id: 'bad),user_id.eq.other', createdAt: 'now' })).toThrow('Invalid timeline cursor')
    expect(cursorFilter({ id: '11111111-1111-4111-8111-111111111111', createdAt: '2026-11-08T14:00:00.000123+00:00' })).toContain('id.gt.')
  })
})
