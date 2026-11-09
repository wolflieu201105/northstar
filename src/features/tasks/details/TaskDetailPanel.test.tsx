import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import { makeLabel, makeMember, makeTask } from '../../../test/fixtures'
import { fetchComments, createComment } from '../../comments/services/comments'
import { fetchActivity } from '../../activity/services/activity'
import type { NavigationGuard } from '../../../shared/types/navigation'
import { TaskDetailPanel } from './TaskDetailPanel'

vi.mock('../../comments/services/comments', () => ({ fetchComments: vi.fn(), createComment: vi.fn() }))
vi.mock('../../activity/services/activity', () => ({ fetchActivity: vi.fn() }))
const task = makeTask()
const client = {} as AppClient
function panelProps() {
  const guards = new Set<NavigationGuard>()
  const onClose = vi.fn()
  return {
    client, userId: 'user-1', groupId: task.group_id, task, isLoading: false, loadError: null, isTaskPending: false, opener: null,
    registerGuard: (guard: NavigationGuard) => { guards.add(guard); return () => { guards.delete(guard) } },
    onClose: () => { if ([...guards].every((guard) => guard())) onClose() },
    closed: onClose, canLeave: () => [...guards].every((guard) => guard()),
    onDeleted: vi.fn(), onRetry: vi.fn(), onVisit: vi.fn(), onDelete: vi.fn().mockResolvedValue(undefined),
    onSave: vi.fn().mockResolvedValue({ ...task, title: 'Updated title', updated_at: '2026-11-08T16:00:00.123456Z' }),
    workspace: {
      members: [], labels: [], membersLoading: false, labelsLoading: false, memberError: null, labelError: null,
      reloadMembers: vi.fn(), reloadLabels: vi.fn(), addMember: vi.fn(), editMember: vi.fn(), setMemberArchived: vi.fn(),
      addLabel: vi.fn(), editLabel: vi.fn(), setLabelArchived: vi.fn(),
    },
  }
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchComments).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(fetchActivity).mockResolvedValue({ items: [], nextCursor: null })
})

describe('TaskDetailPanel', () => {
  it.each([false, true])('saves an archived label removal with an empty or multiple-label replacement (multiple: %s)', async (multiple) => {
    const props = panelProps()
    const archived = makeLabel({ id: 'old-label', name: 'Old label', archived_at: '2026-11-08T14:00:00Z' })
    const labels = [makeLabel(), makeLabel({ id: 'label-2', name: 'Feature' }), archived]
    render(<TaskDetailPanel {...props} task={{ ...task, labels: [archived] }} workspace={{ ...props.workspace, labels }} />)
    fireEvent.click(screen.getByLabelText('Old label (Archived)'))
    if (multiple) { fireEvent.click(screen.getByLabelText('Bug')); fireEvent.click(screen.getByLabelText('Feature')) }
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ labelIds: multiple ? ['label-1', 'label-2'] : [] }), task.updated_at))
  })

  it('tracks a clean task through an optimistic move rollback even when its edit token stays unchanged', () => {
    const props = panelProps()
    const { rerender } = render(<TaskDetailPanel {...props} task={{ ...task, status: 'in_progress' }} isTaskPending />)
    expect(screen.getByLabelText('Status')).toHaveValue('in_progress')
    rerender(<TaskDetailPanel {...props} />)
    expect(screen.getByLabelText('Status')).toHaveValue(task.status)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('keeps the panel open after a save and uses the exact edit token with all relation IDs', async () => {
    const props = panelProps()
    const { rerender } = render(<TaskDetailPanel {...props} />)
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Updated title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated title', assigneeIds: [], labelIds: [] }), task.updated_at))
    const saved = await props.onSave.mock.results[0].value
    rerender(<TaskDetailPanel {...props} task={saved} />)
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(screen.getByRole('status')).toHaveTextContent('Changes saved.')
    expect(props.closed).not.toHaveBeenCalled()
    expect(props.canLeave()).toBe(true)
  })

  it('preserves dirty metadata on external updates until the user accepts the latest version', async () => {
    const props = panelProps()
    const { rerender } = render(<TaskDetailPanel {...props} />)
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'My draft' } })
    rerender(<TaskDetailPanel {...props} task={{ ...task, title: 'Changed elsewhere', updated_at: '2026-11-08T18:00:00.123456Z' }} />)
    expect(screen.getByLabelText('Task title')).toHaveValue('My draft')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Use latest saved task' }))
    expect(screen.getByLabelText('Task title')).toHaveValue('My draft')
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Use latest saved task' }))
    expect(screen.getByLabelText('Task title')).toHaveValue('Changed elsewhere')
    await waitFor(() => expect(props.canLeave()).toBe(true))
    confirm.mockRestore()
  })

  it('retains comment drafts across tabs and failures and guards Escape/discard', async () => {
    const props = panelProps()
    vi.mocked(createComment).mockRejectedValue(new Error('Connection lost'))
    render(<TaskDetailPanel {...props} />)
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'Keep this note' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }))
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Activity' }), { key: 'ArrowLeft' })
    expect(screen.getByLabelText('Write a comment')).toHaveValue('Keep this note')
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(await screen.findByText('Connection lost')).toBeVisible()
    expect(screen.getByLabelText('Write a comment')).toHaveValue('Keep this note')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(props.closed).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close task details' }))
    expect(props.closed).toHaveBeenCalledOnce()
    confirm.mockRestore()
  })

  it('blocks navigation during a save, keeps failure drafts, and deletes only after confirmation', async () => {
    const props = panelProps()
    let rejectSave!: (error: Error) => void
    props.onSave.mockReturnValue(new Promise((_, reject) => { rejectSave = reject }))
    render(<TaskDetailPanel {...props} />)
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Keep my edit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(props.canLeave()).toBe(false)
    await act(async () => { rejectSave(new Error('Save failed')) })
    expect(screen.getByText('Save failed')).toBeVisible()
    expect(screen.getByLabelText('Task title')).toHaveValue('Keep my edit')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    expect(props.onDelete).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete task' }))
    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledOnce())
    confirm.mockRestore()
  })

  it('shows missing tasks without loading their discussion and restores focus on unmount', async () => {
    const props = panelProps()
    const opener = document.createElement('button')
    document.body.append(opener)
    const { unmount } = render(<TaskDetailPanel {...props} task={undefined} opener={opener} />)
    expect(screen.getByText('This task is unavailable')).toBeVisible()
    expect(fetchComments).not.toHaveBeenCalled()
    expect(fetchActivity).not.toHaveBeenCalled()
    unmount()
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    opener.remove()
  })

  it('saves multiple selections, permits archived removal, and keeps lookup failures independent', async () => {
    const props = panelProps()
    const member = makeMember({ display_name: 'Alex' })
    const archived = makeMember({ id: 'member-2', display_name: 'Morgan', username: 'morgan' })
    const label = makeLabel()
    render(<TaskDetailPanel {...props} task={{ ...task, assignees: [archived] }} workspace={{ ...props.workspace, members: [member], labels: [label], memberError: 'Members could not refresh' }} />)
    fireEvent.click(screen.getByLabelText('Alex (@alex_lee)'))
    fireEvent.click(screen.getByLabelText('Morgan (@morgan) (Unavailable)'))
    fireEvent.click(screen.getByLabelText('Bug'))
    expect(screen.getByText('Members could not refresh')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry assignees' }))
    expect(props.workspace.reloadMembers).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ assigneeIds: ['member-1'], labelIds: ['label-1'] }), task.updated_at))
  })
})
