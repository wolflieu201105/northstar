import { describe, expect, it } from 'vitest'
import { filterTasks, getBoardSummary, getDueState, toTaskInsert } from './utils'
import { makeTask } from '../../test/fixtures'

const now = new Date(2026, 10, 8, 12)

describe('getDueState', () => {
  it('compares due dates as local calendar dates', () => {
    expect(getDueState('2026-11-07', 'todo', now)).toBe('overdue')
    expect(getDueState('2026-11-08', 'todo', now)).toBe('today')
    expect(getDueState('2026-11-11', 'todo', now)).toBe('upcoming')
    expect(getDueState('2026-11-12', 'todo', now)).toBe('later')
  })

  it('does not flag completed tasks as overdue', () => {
    expect(getDueState('2026-11-01', 'done', now)).toBeNull()
  })
})

describe('filterTasks', () => {
  const tasks = [
    makeTask(),
    makeTask({
      id: 'task-2',
      title: 'Review homepage',
      description: 'Check the COMPANY messaging.',
      priority: 'high',
    }),
  ]

  it('searches titles and descriptions without case sensitivity', () => {
    expect(filterTasks(tasks, 'launch', 'all')).toHaveLength(1)
    expect(filterTasks(tasks, 'company', 'all')).toEqual([tasks[1]])
  })

  it('combines search and priority filters', () => {
    expect(filterTasks(tasks, 'review', 'high')).toEqual([tasks[1]])
    expect(filterTasks(tasks, 'review', 'low')).toEqual([])
  })
})

describe('getBoardSummary', () => {
  it('derives whole-board counts', () => {
    const tasks = [
      makeTask({ due_date: '2026-11-07' }),
      makeTask({ id: 'task-2', status: 'done', due_date: '2026-11-01' }),
      makeTask({ id: 'task-3', status: 'in_progress', due_date: null }),
    ]

    expect(getBoardSummary(tasks, now)).toEqual({ total: 3, completed: 1, overdue: 1 })
  })
})

describe('toTaskInsert', () => {
  it('trims text and converts optional blank fields to null', () => {
    expect(
      toTaskInsert({
        title: '  Write release notes  ',
        description: '   ',
        status: 'in_review',
        priority: 'high',
        due_date: '',
      }),
    ).toEqual({
      title: 'Write release notes',
      description: null,
      status: 'in_review',
      priority: 'high',
      due_date: null,
    })
  })
})
