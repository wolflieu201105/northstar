import { describe, expect, it } from 'vitest'
import { cursorFilter, timelinePage } from './timeline'
import { parseActivity } from '../lib/dataValidation'
import type { Tables } from '../types/database'

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
  it('retains an unknown event payload for a safe future UI fallback', () => {
    const row: Tables<'task_activity'> = {
      id: 'event-1', user_id: 'user-1', actor_user_id: 'user-1', task_id: 'task-1',
      created_at: '2026-11-08T14:00:00Z', event_type: 'task_edited', payload: { version: 2, new_shape: true },
    }
    expect(parseActivity(row)).toMatchObject({ event_type: 'unknown', originalEventType: 'task_edited', payload: row.payload })
  })
})
