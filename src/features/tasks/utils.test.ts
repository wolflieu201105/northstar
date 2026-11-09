import { describe, expect, it } from 'vitest'
import { filterTasks, getBoardSummary, getDueState, toTaskInsert } from './utils'
import { makeLabel, makeMember, makeTask } from '../../test/fixtures'

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
    expect(getDueState(null, 'todo', now)).toBeNull()
  })

  it.each([
    [new Date(2026, 11, 31, 23, 59), '2027-01-01', 'upcoming'],
    [new Date(2027, 0, 1), '2026-12-31', 'overdue'],
    [new Date(2028, 1, 28), '2028-03-02', 'upcoming'],
    [new Date(2026, 2, 7, 12), '2026-03-10', 'upcoming'],
    [new Date(2026, 2, 7, 12), '2026-03-11', 'later'],
    [new Date(2026, 9, 31, 12), '2026-11-03', 'upcoming'],
    [new Date(2026, 9, 31, 12), '2026-11-04', 'later'],
  ] as const)('uses calendar days at month/year/leap/DST boundaries (%s, %s)', (date, dueDate, expected) => {
    expect(getDueState(dueDate, 'todo', date)).toBe(expected)
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

  it('matches ANY within relationship groups and AND across all four groups, without duplicating tasks', () => {
    const alex = makeMember()
    const sam = makeMember({ id: 'member-2', display_name: 'Sam' })
    const bug = makeLabel()
    const design = makeLabel({ id: 'label-2', name: 'Design' })
    const board = [
      makeTask({ title: 'Launch fix', priority: 'high', assignees: [alex, sam], labels: [bug, design] }),
      makeTask({ id: 'task-2', title: 'Launch review', priority: 'high', assignees: [sam], labels: [design] }),
      makeTask({ id: 'task-3', title: 'Launch low', priority: 'low', assignees: [alex], labels: [bug] }),
      makeTask({ id: 'task-4', title: 'Launch unassigned', priority: 'high', labels: [bug] }),
      makeTask({ id: 'task-5', title: 'Unrelated', description: null, priority: 'high', assignees: [alex], labels: [bug] }),
    ]
    expect(filterTasks(board, '  LAUNCH  ', 'high', { assignee: [alex.id, sam.id], label: [bug.id, design.id] })).toEqual(board.slice(0, 2))
    expect(filterTasks(board, 'launch', 'high', { assignee: [sam.id], label: [bug.id] })).toEqual([board[0]])
    expect(getBoardSummary(board, now).total).toBe(5)
    expect(board[0].assignees).toEqual([alex, sam])
    expect(board[0].labels).toEqual([bug, design])
  })

  it('distinguishes Unassigned, Unlabeled, and empty selections', () => {
    const board = [
      makeTask(),
      makeTask({ id: 'assigned', assignees: [makeMember()] }),
      makeTask({ id: 'labeled', labels: [makeLabel()] }),
    ]
    expect(filterTasks(board, '', 'all', { assignee: 'none' })).toEqual([board[0], board[2]])
    expect(filterTasks(board, '', 'all', { label: 'none' })).toEqual([board[0], board[1]])
    expect(filterTasks(board, '', 'all', { assignee: 'none', label: 'none' })).toEqual([board[0]])
    expect(filterTasks(board, '', 'all', { assignee: [], label: [] })).toEqual(board)
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
