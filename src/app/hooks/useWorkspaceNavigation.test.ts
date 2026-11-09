import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceNavigation } from './useWorkspaceNavigation'
import { parseWorkspaceLocation } from '../state/navigationStore'

beforeEach(() => { window.history.replaceState(null, '', '/'); vi.restoreAllMocks() })

describe('workspace navigation', () => {
  it('guards group changes, clears task details, and restores filters and scroll only within this identity', () => {
    window.history.replaceState({}, '', '/?group=A&task=task-A&q=launch&assignee=member-A')
    const { result, unmount } = renderHook(useWorkspaceNavigation)
    const guard = vi.fn(() => false)
    const unregister = result.current.registerGuard(guard)
    act(() => { expect(result.current.selectGroup('B')).toBe(false) })
    expect(result.current.groupId).toBe('A')
    unregister()
    act(() => { result.current.saveScroll('A', { left: 73, top: 120 }); result.current.selectGroup('B') })
    expect(result.current).toMatchObject({ groupId: 'B', taskId: null, query: '', assignee: 'all' })
    act(() => { result.current.setLabel(['label-B']); result.current.selectGroup('A') })
    expect(result.current).toMatchObject({ groupId: 'A', taskId: null, query: 'launch', assignee: ['member-A'], label: 'all' })
    expect(result.current.getScroll('A')).toEqual({ left: 73, top: 120 })
    unmount()
    window.history.replaceState({}, '', '/?group=B')
    const nextIdentity = renderHook(useWorkspaceNavigation)
    act(() => { nextIdentity.result.current.selectGroup('A') })
    expect(nextIdentity.result.current).toMatchObject({ query: '', assignee: 'all', label: 'all' })
    expect(nextIdentity.result.current.getScroll('A')).toEqual({ left: 0, top: 0 })
  })

  it('keeps initial unscoped filters when assigning the default group and opens an already selected group', () => {
    window.history.replaceState({}, '', '/?view=groups&q=launch')
    const { result } = renderHook(useWorkspaceNavigation)
    act(() => { result.current.selectGroup('A', true, true, true) })
    expect(result.current).toMatchObject({ groupId: 'A', view: 'groups', query: 'launch' })
    act(() => { result.current.selectGroup('A') })
    expect(result.current.view).toBe('board')
  })
  it('normalizes unsupported views/priorities and gives management views precedence over tasks', () => {
    expect(parseWorkspaceLocation('/?view=unknown&priority=urgent&q=demo').view).toBe('board')
    expect(parseWorkspaceLocation('/?view=unknown&priority=urgent&q=demo').href).toBe('/?q=demo')
    expect(parseWorkspaceLocation('/?view=labels&task=private&assignee=one')).toMatchObject({
      view: 'labels', taskId: null, href: '/?view=labels&assignee=one',
    })
  })

  it('preserves filters between views and task links, replacing typing history', () => {
    const { result } = renderHook(useWorkspaceNavigation)
    const push = vi.spyOn(window.history, 'pushState')
    act(() => {
      result.current.setQuery('launch'); result.current.setPriority('high')
      result.current.setAssignee(['member-1', 'member-2']); result.current.setLabel(['label-1', 'label-2'])
    })
    expect(push).not.toHaveBeenCalled()
    act(() => { result.current.visit('members') })
    expect(result.current).toMatchObject({ view: 'members', query: 'launch', priority: 'high', assignee: ['member-1', 'member-2'], label: ['label-1', 'label-2'] })
    act(() => { result.current.openTask('task-1') })
    expect(result.current).toMatchObject({ view: 'board', taskId: 'task-1', query: 'launch', priority: 'high' })
    expect(push).toHaveBeenCalledTimes(2)
    act(() => { result.current.closeTask() })
    expect(result.current.taskId).toBeNull()
    expect(result.current.query).toBe('launch')
    expect(new URLSearchParams(window.location.search).getAll('label')).toEqual(['label-1', 'label-2'])
    act(() => { result.current.clearFilters() })
    expect(window.location.search).toBe('')
    expect(result.current).toMatchObject({ query: '', priority: 'all', assignee: 'all', label: 'all' })
  })

  it('normalizes repeated IDs and exclusive Unassigned/Unlabeled modes on refresh', () => {
    window.history.replaceState(null, '', '/?assignee=one&assignee=one&assignee=two&label=bug&label=unlabeled&label=design')
    const { result, unmount } = renderHook(useWorkspaceNavigation)
    expect(result.current).toMatchObject({ assignee: ['one', 'two'], label: 'none' })
    expect(new URLSearchParams(window.location.search).getAll('label')).toEqual(['unlabeled'])
    act(() => { result.current.setAssignee('none'); result.current.setLabel(['design', 'bug']) })
    unmount()
    const restored = renderHook(useWorkspaceNavigation)
    expect(restored.result.current).toMatchObject({ assignee: 'none', label: ['design', 'bug'] })
    act(() => { restored.result.current.visit('labels'); restored.result.current.clearFilters() })
    expect(window.location.search).toBe('?view=labels')
  })

  it('restores a direct task link after initialization and closes safely within the board', () => {
    window.history.replaceState(null, '', '/?task=task-1&q=demo')
    const { result } = renderHook(useWorkspaceNavigation)
    expect(result.current.taskId).toBe('task-1')
    const back = vi.spyOn(window.history, 'back')
    act(() => { result.current.closeTask() })
    expect(back).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?q=demo')
  })

  it('handles Back/Forward and restores cancelled Back without losing the selected task', async () => {
    const { result } = renderHook(useWorkspaceNavigation)
    act(() => {
      result.current.setAssignee(['member-1']); result.current.setLabel('none')
      result.current.visit('members'); result.current.setAssignee('none'); result.current.openTask('task-1')
    })
    const guard = vi.fn(() => false)
    const unregister = result.current.registerGuard(guard)
    act(() => { window.history.back() })
    await waitFor(() => expect(guard).toHaveBeenCalledOnce())
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('task')).toBe('task-1'))
    expect(result.current.taskId).toBe('task-1')
    unregister()
    act(() => { window.history.back() })
    await waitFor(() => expect(result.current.view).toBe('members'))
    act(() => { window.history.forward() })
    await waitFor(() => expect(result.current.taskId).toBe('task-1'))
    expect(result.current.assignee).toBe('none')
    expect(result.current.label).toBe('none')
  })
})
