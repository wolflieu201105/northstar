import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskForm } from './TaskForm'

describe('TaskForm', () => {
  it('keeps the dialog open and explains when the title is blank', async () => {
    const onSave = vi.fn()
    render(
      <TaskForm
        task={null}
        defaultStatus="todo"
        opener={null}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Give this task a title before saving it.',
    )
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Task title')).toHaveFocus()
  })

  it('submits normalized task data', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(
      <TaskForm
        task={null}
        defaultStatus="in_progress"
        opener={null}
        onSave={onSave}
        onClose={onClose}
      />,
    )

    fireEvent.change(screen.getByLabelText('Task title'), {
      target: { value: '  Prepare the demo  ' },
    })
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: 'Show the completed task flow.' },
    })
    fireEvent.change(screen.getByLabelText(/Priority/), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText(/Due date/), {
      target: { value: '2026-11-12' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        title: 'Prepare the demo',
        description: 'Show the completed task flow.',
        status: 'in_progress',
        priority: 'high',
        due_date: '2026-11-12',
      }),
    )
    expect(onClose).toHaveBeenCalledOnce()
  })
})
