import { describe, expect, it } from 'vitest'
import { parseActivity } from './validation'
import type { Tables } from '../../shared/types/database'

describe('activity payload validation', () => {
  it('retains an unknown event payload for a safe future UI fallback', () => {
    const row: Tables<'task_activity'> = {
      id: 'event-1', group_id: 'group-1', actor_name: 'Alex', actor_user_id: 'user-1', task_id: 'task-1',
      created_at: '2026-11-08T14:00:00Z', event_type: 'task_edited', payload: { version: 2, new_shape: true },
    }
    expect(parseActivity(row)).toMatchObject({ event_type: 'unknown', originalEventType: 'task_edited', payload: row.payload })
  })
})
