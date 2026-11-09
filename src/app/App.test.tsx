import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTasks, updateTask } from '../features/tasks/services/tasks'
import { fetchTeamMembers } from '../features/team/services/team'
import { fetchLabels } from '../features/labels/services/labels'
import { fetchComments } from '../features/comments/services/comments'
import { fetchActivity } from '../features/activity/services/activity'
import { makeTask } from '../test/fixtures'
import App from './App'

vi.mock('../shared/lib/supabase', () => ({ supabase: {}, supabaseConfigError: null }))
vi.mock('../features/auth/useGuestSession', () => ({ useGuestSession: () => ({ session: { user: { id: 'user-1' } }, isLoading: false, error: null, retry: vi.fn() }) }))
vi.mock('../features/tasks/services/tasks', () => ({ fetchTasks: vi.fn(), fetchTask: vi.fn(), createTask: vi.fn(), updateTask: vi.fn(), updateTaskStatus: vi.fn(), deleteTask: vi.fn() }))
vi.mock('../features/team/services/team', () => ({ fetchTeamMembers: vi.fn(), createMember: vi.fn(), updateMember: vi.fn(), archiveMember: vi.fn() }))
vi.mock('../features/labels/services/labels', async (original) => ({ ...await original<typeof import('../features/labels/services/labels')>(), fetchLabels: vi.fn(), createLabel: vi.fn(), updateLabel: vi.fn(), archiveLabel: vi.fn() }))
vi.mock('../features/comments/services/comments', () => ({ fetchComments: vi.fn(), createComment: vi.fn() }))
vi.mock('../features/activity/services/activity', () => ({ fetchActivity: vi.fn() }))
vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useDraggable: () => ({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }),
  useDroppable: () => ({ ref: vi.fn(), isDropTarget: false }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  vi.mocked(fetchTasks).mockResolvedValue([makeTask({ priority: 'high' })])
  vi.mocked(fetchTeamMembers).mockResolvedValue([])
  vi.mocked(fetchLabels).mockResolvedValue([])
  vi.mocked(fetchComments).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(fetchActivity).mockResolvedValue({ items: [], nextCursor: null })
})

describe('workspace composition', () => {
  it('keeps board filters/scroll through management views and reflects a detail save on the same card', async () => {
    const task = makeTask({ priority: 'high' })
    vi.mocked(updateTask).mockResolvedValue({ ...task, title: 'Updated launch brief', updated_at: '2026-11-09T06:00:00.123456Z' })
    render(<App />)
    await screen.findByRole('button', { name: task.title })
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'launch' } })
    fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'high' } })
    const board = screen.getByLabelText('Task board')
    board.scrollLeft = 73
    const navigation = screen.getByRole('navigation', { name: 'Workspace' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Team' }))
    await screen.findByRole('heading', { name: 'Team' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Labels' }))
    await screen.findByRole('heading', { name: 'Labels' })
    fireEvent.click(within(navigation).getByRole('button', { name: 'Board' }))
    expect(screen.getByLabelText('Task board')).toBe(board)
    expect(board.scrollLeft).toBe(73)
    expect(screen.getByLabelText('Search tasks')).toHaveValue('launch')
    expect(screen.getByLabelText('Filter by priority')).toHaveValue('high')
    fireEvent.click(screen.getByRole('button', { name: task.title }))
    await screen.findByRole('dialog', { name: task.title })
    fireEvent.change(screen.getByLabelText('Task title'), { target: { value: 'Updated launch brief' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Changes saved.')
    expect(updateTask).toHaveBeenCalledWith(expect.anything(), 'user-1', task.id, expect.objectContaining({ title: 'Updated launch brief' }), task.updated_at)
    fireEvent.click(screen.getByRole('button', { name: 'Close task details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Updated launch brief' })).toBeVisible()
    expect(fetchTasks).toHaveBeenCalledOnce()
    expect(fetchTeamMembers).toHaveBeenCalledOnce()
    expect(fetchLabels).toHaveBeenCalledOnce()
  })
})
