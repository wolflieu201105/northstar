import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaskForm } from './TaskForm'
import { makeMember } from '../test/fixtures'

describe('TaskForm', () => {
  it.each([false, true])('creates a task with the selected assignees (multiple: %s)', async (multiple) => {
    const members = [makeMember(), makeMember({ id: 'member-2', name: 'Sam Taylor' }), makeMember({ id: 'member-3', name: 'Archived profile', archived_at: '2026-11-08T14:00:00Z' })]
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TaskForm task={null} defaultStatus="todo" opener={null} onSave={onSave} onClose={vi.fn()}
      workspace={{ members, membersLoading: false, memberError: null, reloadMembers: vi.fn() }} />)
    expect(screen.queryByLabelText('Archived profile (Archived)')).not.toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Task with team' } })
    if (multiple) { fireEvent.click(screen.getByLabelText('Alex Lee')); fireEvent.click(screen.getByLabelText('Sam Taylor')) }
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: multiple ? ['member-1', 'member-2'] : [] })))
  })

  it('confirms draft discard and dismisses creation when navigation is accepted', async () => {
    let guard: (() => boolean) | undefined
    const onClose = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TaskForm task={null} defaultStatus="todo" opener={null} onSave={vi.fn()} onClose={onClose}
      registerGuard={(next) => { guard = next; return () => { guard = undefined } }} />)
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Unsaved creation' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(guard?.()).toBe(false)
    confirm.mockReturnValue(true)
    expect(guard?.()).toBe(true)
    expect(onClose).toHaveBeenCalledOnce()
    confirm.mockRestore()
  })

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
