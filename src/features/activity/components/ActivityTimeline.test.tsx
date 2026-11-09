import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeActivity } from '../../../test/fixtures'
import type { TaskActivity } from '../types'
import type { PaginatedTimelineState } from '../../../shared/types/timeline'
import { ActivityTimeline } from './ActivityTimeline'

const initial = (): PaginatedTimelineState<TaskActivity> => ({ items: [], nextCursor: null, isLoading: false, isLoadingMore: false, failedLoadMore: false, error: null })
const actions = () => ({ onRetry: vi.fn(), onLoadMore: vi.fn(), onRefresh: vi.fn() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('ActivityTimeline', () => {
  it('shows the recorded actor, exact accessible timestamp, and safely expandable old/new values', () => {
    const literal = '<img src=x onerror=alert(1)>'
    const event: TaskActivity = { ...makeActivity(), event_type: 'task_edited', payload: { version: 2, changes: { title: { from: 'Original title', to: literal } } } }
    const { container } = render(<ActivityTimeline activity={{ ...initial(), items: [event] }} {...actions()} />)
    expect(screen.getByText('Updated title')).toBeVisible()
    expect(screen.getByText('Alex')).toBeVisible()
    const time = container.querySelector('time')!
    expect(time).toHaveAttribute('datetime', event.created_at)
    expect(time.getAttribute('aria-label')).toContain(time.title)
    fireEvent.click(screen.getByText('View changes'))
    expect(screen.getByText('Original title')).toBeVisible()
    expect(screen.getByText(literal)).toBeVisible()
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('From')).toBeVisible()
    expect(screen.getByText('To')).toBeVisible()
  })

  it('updates relative labels with one clock and clears that clock when unmounted', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    const now = Date.parse('2026-11-09T06:00:00Z')
    vi.setSystemTime(now)
    const event = makeActivity({ created_at: new Date(now - 59_000).toISOString() })
    const { unmount } = render(<ActivityTimeline activity={{ ...initial(), items: [event, { ...event, id: 'event-2' }] }} {...actions()} />)
    expect(screen.getAllByText('Just now')).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(1)
    act(() => { vi.advanceTimersByTime(30_000) })
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'always' })
    expect(screen.getAllByText(formatter.format(-1, 'minute'))).toHaveLength(2)
    vi.setSystemTime(now + 3 * 60_000)
    fireEvent.focus(window)
    expect(screen.getAllByText(formatter.format(-3, 'minute'))).toHaveLength(2)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('distinguishes initial loading, failed page recovery, manual refresh, and baseline history', () => {
    const handlers = actions()
    const { rerender } = render(<ActivityTimeline activity={{ ...initial(), isLoading: true }} {...handlers} />)
    expect(screen.getByText('Loading activity…')).toBeVisible()
    expect(screen.queryByText(/Changes made before history/)).not.toBeInTheDocument()
    const event = makeActivity()
    rerender(<ActivityTimeline activity={{ ...initial(), items: [event], nextCursor: { id: event.id, createdAt: event.created_at }, error: 'Page unavailable', failedLoadMore: true }} {...handlers} />)
    expect(screen.getByText('Created this task')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading more activity' }))
    expect(handlers.onRetry).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh activity' }))
    expect(handlers.onRefresh).toHaveBeenCalledOnce()
    rerender(<ActivityTimeline activity={{ ...initial(), items: [event], nextCursor: { id: event.id, createdAt: event.created_at } }} {...handlers} />)
    fireEvent.click(screen.getByRole('button', { name: 'Load more activity' }))
    expect(handlers.onLoadMore).toHaveBeenCalledOnce()
    expect(within(screen.getByRole('list', { name: 'Activity, oldest first' })).getAllByRole('listitem')).toHaveLength(1)
    rerender(<ActivityTimeline activity={initial()} {...handlers} />)
    expect(screen.getByText(/Changes made before history was enabled are unavailable/)).toBeVisible()
  })
})
