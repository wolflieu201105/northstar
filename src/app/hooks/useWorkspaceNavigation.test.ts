import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceNavigation } from './useWorkspaceNavigation'
import { parseWorkspaceLocation } from '../state/navigationStore'

beforeEach(() => { window.history.replaceState(null, '', '/'); vi.restoreAllMocks() })

describe('workspace navigation', () => {
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
    act(() => { result.current.setQuery('launch'); result.current.setPriority('high') })
    expect(push).not.toHaveBeenCalled()
    act(() => { result.current.visit('team') })
    expect(result.current).toMatchObject({ view: 'team', query: 'launch', priority: 'high' })
    act(() => { result.current.openTask('task-1') })
    expect(result.current).toMatchObject({ view: 'board', taskId: 'task-1', query: 'launch', priority: 'high' })
    expect(push).toHaveBeenCalledTimes(2)
    act(() => { result.current.closeTask() })
    expect(result.current.taskId).toBeNull()
    expect(result.current.query).toBe('launch')
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
    act(() => { result.current.visit('team'); result.current.openTask('task-1') })
    const guard = vi.fn(() => false)
    const unregister = result.current.registerGuard(guard)
    act(() => { window.history.back() })
    await waitFor(() => expect(guard).toHaveBeenCalledOnce())
    await waitFor(() => expect(window.location.search).toBe('?task=task-1'))
    expect(result.current.taskId).toBe('task-1')
    unregister()
    act(() => { window.history.back() })
    await waitFor(() => expect(result.current.view).toBe('team'))
    act(() => { window.history.forward() })
    await waitFor(() => expect(result.current.taskId).toBe('task-1'))
  })
})
