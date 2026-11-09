import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeTask } from '../../../test/fixtures'
import { TaskCard } from './TaskCard'

vi.mock('@dnd-kit/react', () => ({ useDraggable: () => ({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }) }))

describe('task card due dates', () => {
  it('keeps a completed task’s saved date neutral and shows urgency immediately when reopened', () => {
    const task = makeTask({ status: 'done', due_date: '2026-11-01' })
    const props = { today: new Date(2026, 10, 9), isMoving: false, onEdit: vi.fn() }
    const { container, rerender } = render(<TaskCard task={task} {...props} />)
    expect(container.querySelector('time')).toHaveAttribute('datetime', task.due_date)
    expect(container.querySelector('.due-date')).toHaveClass('due-later')
    expect(screen.queryByText('No due date')).not.toBeInTheDocument()
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument()
    rerender(<TaskCard task={{ ...task, status: 'todo' }} {...props} />)
    expect(screen.getByText(/Overdue/)).toBeVisible()
    rerender(<TaskCard task={{ ...task, status: 'todo', due_date: null }} {...props} />)
    expect(screen.getByText('No due date')).toBeVisible()
  })
})
