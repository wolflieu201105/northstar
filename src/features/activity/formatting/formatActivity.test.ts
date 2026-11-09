import { describe, expect, it } from 'vitest'
import { makeActivity } from '../../../test/fixtures'
import type { TaskActivity } from '../types'
import { formatActivity } from './formatActivity'
import { parseActivity } from '../validation'

describe('activity presentation', () => {
  it('retains the creation title and initial status', () => {
    expect(formatActivity(makeActivity())).toEqual({ summary: 'Created this task', context: '“Prepare launch brief” · To do' })
  })

  it('shows saved status transitions', () => {
    expect(formatActivity({ ...makeActivity(), event_type: 'status_changed', payload: { version: 2, from: 'todo', to: 'in_progress' } }).summary)
      .toBe('Moved from To do → In progress')
  })

  it.each([
    { type: 'assignee_added', expected: 'Assigned Alex at the time' },
    { type: 'assignee_removed', expected: 'Unassigned Alex at the time' },
  ] as const)('uses the historical member snapshot for $type', ({ type, expected }) => {
    const event: TaskActivity = { ...makeActivity(), event_type: type, payload: { version: 2, assignee_user_id: 'member-1', assignee_name: 'Alex at the time', avatar_color: null } }
    expect(formatActivity(event).summary).toBe(expected)
  })

  it.each([
    { type: 'label_added', expected: 'Added label “Old Bug name”' },
    { type: 'label_removed', expected: 'Removed label “Old Bug name”' },
  ] as const)('uses the historical label snapshot for $type', ({ type, expected }) => {
    const event: TaskActivity = { ...makeActivity(), event_type: type, payload: { version: 2, label_id: 'label-1', label_name: 'Old Bug name', color: '#20895b' } }
    expect(formatActivity(event).summary).toBe(expected)
  })

  it('formats saved old/new fields in a consistent order, including cleared values', () => {
    const event: TaskActivity = { ...makeActivity(), event_type: 'task_edited', payload: { version: 2, changes: {
      due_date: { from: '2026-11-09', to: null }, priority: { from: 'normal', to: 'high' },
      description: { from: null, to: 'First line\nSecond line' }, title: { from: 'Old title', to: '<b>New title</b>' },
    } } }
    const formatted = formatActivity(event)
    expect(formatted.summary).toBe('Updated title, description, priority and due date')
    expect(formatted.changes?.map((change) => change.field)).toEqual(['title', 'description', 'priority', 'due_date'])
    expect(formatted.changes?.[0]).toMatchObject({ from: 'Old title', to: '<b>New title</b>' })
    expect(formatted.changes?.[1]).toMatchObject({ from: 'No description', to: 'First line\nSecond line' })
    expect(formatted.changes?.[2]).toMatchObject({ from: 'Normal', to: 'High' })
    expect(formatted.changes?.[3].to).toBe('No due date')
    expect(formatted.changes?.[3].from).toContain('2026')
  })

  it('uses a generic summary for unsupported fields or malformed field values', () => {
    const event: TaskActivity = { ...makeActivity(), event_type: 'task_edited', payload: { version: 2, changes: {
      future_field: { from: [], to: { secret: 'do not render raw JSON' } },
      due_date: { from: 'invalid', to: '2026-02-31' }, priority: { from: 'normal', to: 'unknown' },
    } } }
    expect(formatActivity(event)).toEqual({ summary: 'Updated task details', changes: [] })
  })

  it.each([{ event_type: 'future_event', payload: { version: 2, raw: '<script>bad()</script>' } },
    { event_type: 'task_edited', payload: { version: 1, changes: {} } }])('handles unknown/older payload contracts safely', ({ event_type, payload }) => {
    const parsed = parseActivity({ ...makeActivity(), event_type, payload })
    expect(formatActivity(parsed)).toEqual({ summary: 'Task activity recorded', context: 'Additional details are unavailable.' })
  })
})
