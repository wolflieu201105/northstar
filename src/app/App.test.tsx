import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchTasks, updateTask } from '../features/tasks/services/tasks'
import { fetchTeamMembers } from '../features/team/services/team'
import { fetchLabels } from '../features/labels/services/labels'
import { fetchComments } from '../features/comments/services/comments'
import { fetchActivity } from '../features/activity/services/activity'
import { makeLabel, makeMember, makeTask } from '../test/fixtures'
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
    const member = makeMember()
    const label = makeLabel()
    const task = makeTask({ priority: 'high', assignees: [member], labels: [label] })
    vi.mocked(fetchTasks).mockResolvedValue([task])
    vi.mocked(fetchTeamMembers).mockResolvedValue([member])
    vi.mocked(fetchLabels).mockResolvedValue([label])
    vi.mocked(updateTask).mockResolvedValue({ ...task, title: 'Updated launch brief', updated_at: '2026-11-09T06:00:00.123456Z' })
    render(<App />)
    await screen.findByRole('button', { name: task.title })
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'launch' } })
    fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'high' } })
    const filters = screen.getByRole('group', { name: 'Board filters' })
    filters.querySelectorAll('details').forEach((details) => { details.open = true })
    fireEvent.click(within(filters).getByRole('checkbox', { name: member.name }))
    fireEvent.click(within(filters).getByRole('checkbox', { name: label.name }))
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
    expect(within(filters).getByRole('checkbox', { name: member.name })).toBeChecked()
    expect(within(filters).getByRole('checkbox', { name: label.name })).toBeChecked()
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

  it('combines relationship filters, preserves whole-board counts, and clears all groups without hiding columns', async () => {
    const alex = makeMember()
    const sam = makeMember({ id: 'member-2', name: 'Sam', archived_at: '2026-11-09T00:00:00Z' })
    const bug = makeLabel()
    const archived = makeLabel({ id: 'label-2', name: 'Design', archived_at: sam.archived_at })
    const tasks = [
      makeTask({ title: 'Launch fix', priority: 'high', assignees: [alex, sam], labels: [bug, archived] }),
      makeTask({ id: 'task-2', title: 'Launch review', priority: 'high', assignees: [sam], labels: [archived] }),
      makeTask({ id: 'task-3', title: 'Unassigned task', status: 'done' }),
    ]
    vi.mocked(fetchTasks).mockResolvedValue(tasks)
    vi.mocked(fetchTeamMembers).mockResolvedValue([alex, sam])
    vi.mocked(fetchLabels).mockResolvedValue([bug, archived])
    render(<App />)
    await screen.findByRole('button', { name: 'Launch fix' })
    const filters = screen.getByRole('group', { name: 'Board filters' })
    filters.querySelectorAll('details').forEach((details) => { details.open = true })
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: '  LAUNCH  ' } })
    fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'high' } })
    fireEvent.click(within(filters).getByRole('checkbox', { name: 'Sam (Archived)' }))
    fireEvent.click(within(filters).getByRole('checkbox', { name: 'Bug' }))
    expect(screen.getByText('Showing 1 of 3 tasks')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Launch review' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('1 of 2 tasks visible')).toHaveTextContent('1 of 2')
    expect(screen.getByRole('group', { name: 'Whole-board summary' })).toHaveTextContent('3 Total')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Label: Bug filter' }))
    expect(screen.getByRole('button', { name: 'Launch review' })).toBeVisible()
    fireEvent.click(within(filters).getByRole('button', { name: 'Unassigned' }))
    expect(screen.getByText(/No tasks match these filters/)).toBeVisible()
    expect(within(screen.getByLabelText('Task board')).getAllByRole('heading', { level: 2 })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Showing 3 of 3 tasks')).toBeVisible()
    fireEvent.click(within(filters).getByRole('button', { name: 'Unassigned' }))
    fireEvent.click(within(filters).getByRole('button', { name: 'Unlabeled' }))
    expect(screen.getByText('Showing 1 of 3 tasks')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Unassigned task' })).toBeVisible()
    expect(new URLSearchParams(window.location.search).get('assignee')).toBe('unassigned')
    expect(new URLSearchParams(window.location.search).get('label')).toBe('unlabeled')
  })

  it('retains direct-link selections while lookups load, then ignores unknown IDs', async () => {
    window.history.replaceState(null, '', '/?assignee=member-1&assignee=deleted&label=missing')
    let finishMembers!: (rows: ReturnType<typeof makeMember>[]) => void
    vi.mocked(fetchTeamMembers).mockReturnValue(new Promise((resolve) => { finishMembers = resolve }))
    vi.mocked(fetchTasks).mockResolvedValue([makeTask({ assignees: [makeMember()] })])
    render(<App />)
    await screen.findByText('Loading assignees…')
    expect(new URLSearchParams(window.location.search).getAll('assignee')).toEqual(['member-1', 'deleted'])
    finishMembers([makeMember()])
    await screen.findByRole('button', { name: 'Prepare launch brief' })
    expect(screen.getByText('Showing 1 of 1 tasks')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Remove Assignee: unavailable filter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove Label: unavailable filter' })).not.toBeInTheDocument()
  })

  it('reports unavailable counts when task loading fails and recovers through Retry', async () => {
    vi.mocked(fetchTasks).mockRejectedValueOnce(new Error('offline'))
    render(<App />)
    await screen.findByText('Tasks could not be loaded')
    const summary = screen.getByRole('group', { name: 'Whole-board summary' })
    expect(summary).toHaveTextContent('Counts unavailable')
    expect(summary).not.toHaveTextContent('0 Total')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('button', { name: 'Prepare launch brief' })
    expect(summary).toHaveTextContent('1 Total')
  })
})
