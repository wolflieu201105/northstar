import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BoardSummary } from './BoardSummary'
import { TaskCard } from '../../tasks/components/TaskCard'
import { useBoardDate } from '../hooks/useBoardDate'
import { makeTask } from '../../../test/fixtures'
import type { TaskView } from '../../tasks/types'

vi.mock('@dnd-kit/react', () => ({ useDraggable: () => ({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }) }))
afterEach(() => vi.useRealTimers())

describe('whole-board summary', () => {
  it('does not present loading/error counts as an empty board', () => {
    const props = { tasks: [], today: new Date(2026, 10, 9), isLoading: true, loadError: null }
    const { rerender } = render(<BoardSummary {...props} />)
    expect(screen.getByRole('group')).toHaveTextContent('Loading…')
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    rerender(<BoardSummary {...props} isLoading={false} loadError="offline" />)
    expect(screen.getByRole('group')).toHaveTextContent('Counts unavailable')
    rerender(<BoardSummary {...props} isLoading={false} />)
    expect(screen.getByRole('group')).toHaveTextContent('0 Total')
  })

  it('updates cards and counts together at midnight and after task/due-date/status changes', () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date(2026, 10, 9, 23, 59, 59))
    const task = makeTask({ due_date: '2026-11-09' })
    function Board({ tasks }: { tasks: TaskView[] }) {
      const today = useBoardDate()
      return <><BoardSummary tasks={tasks} today={today} isLoading={false} loadError={null} />
        {tasks.map((row) => <TaskCard key={row.id} task={row} today={today} isMoving={false} onEdit={vi.fn()} />)}</>
    }
    const { rerender } = render(<Board tasks={[task]} />)
    expect(screen.getByText(/Due today/)).toBeVisible()
    expect(screen.getByRole('group')).toHaveTextContent('0 Overdue')
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.getByText(/Overdue/, { selector: '.due-date > span' })).toBeVisible()
    expect(screen.getByRole('group')).toHaveTextContent('1 Overdue')
    rerender(<Board tasks={[{ ...task, status: 'done' }, makeTask({ id: 'new', due_date: '2026-11-11' })]} />)
    expect(screen.getByRole('group')).toHaveTextContent('2 Total1 Completed0 Overdue')
    expect(screen.getByText(/Due soon/)).toBeVisible()
    rerender(<Board tasks={[{ ...task, due_date: '2026-11-10' }]} />)
    expect(screen.getByText(/Due today/)).toBeVisible()
    expect(screen.getByRole('group')).toHaveTextContent('1 Total0 Completed0 Overdue')
    rerender(<Board tasks={[]} />)
    expect(screen.getByRole('group')).toHaveTextContent('0 Total0 Completed0 Overdue')
  })
})
