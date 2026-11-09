import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import type { NavigationGuard } from '../../../shared/types/navigation'
import { fetchTeamMembers, createMember, updateMember, archiveMember } from '../services/team'
import { fetchLabels } from '../../labels/services/labels'
import { fetchTasks } from '../../tasks/services/tasks'
import { useWorkspaceData } from '../../workspace/useWorkspaceData'
import { useTasks } from '../../tasks/hooks/useTasks'
import { makeMember, makeTask } from '../../../test/fixtures'
import { BoardTeam } from '../components/BoardTeam'
import { TaskCard } from '../../tasks/components/TaskCard'
import { TeamPage } from './TeamPage'

vi.mock('../services/team', () => ({ fetchTeamMembers: vi.fn(), createMember: vi.fn(), updateMember: vi.fn(), archiveMember: vi.fn() }))
vi.mock('../../labels/services/labels', () => ({ fetchLabels: vi.fn(), createLabel: vi.fn(), updateLabel: vi.fn(), archiveLabel: vi.fn() }))
vi.mock('../../tasks/services/tasks', () => ({ fetchTasks: vi.fn() }))
vi.mock('@dnd-kit/react', () => ({ useDraggable: () => ({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }) }))
const client = {} as AppClient
const member = makeMember()
const guards = new Set<NavigationGuard>()
const registerGuard = (guard: NavigationGuard) => { guards.add(guard); return () => { guards.delete(guard) } }
function Harness() {
  const workspace = useWorkspaceData(client, 'user-1')
  const tasks = useTasks(client, 'user-1', workspace)
  return <>
    <BoardTeam members={workspace.members} isLoading={workspace.membersLoading} error={workspace.memberError} onRetry={workspace.reloadMembers} onManage={vi.fn()} />
    <TeamPage workspace={workspace} tasks={tasks.tasks} tasksLoading={tasks.isLoading} taskError={tasks.loadError} registerGuard={registerGuard} />
    {tasks.tasks.map((task) => <TaskCard key={task.id} task={task} isMoving={false} onEdit={vi.fn()} />)}
  </>
}

beforeEach(() => {
  vi.resetAllMocks(); guards.clear()
  vi.mocked(fetchTeamMembers).mockResolvedValue([member])
  vi.mocked(fetchLabels).mockResolvedValue([])
  vi.mocked(fetchTasks).mockResolvedValue([makeTask({ assignees: [member] })])
})

describe('Team management with canonical board metadata', () => {
  it('edits, archives, and restores a profile while keeping its task assignments visible', async () => {
    const renamed = { ...member, name: 'Alex Renamed', avatar_color: '#c85058' }
    vi.mocked(updateMember).mockResolvedValue(renamed)
    vi.mocked(archiveMember).mockImplementation(async (_client, _owner, _id, archived) => ({ ...renamed, archived_at: archived ? member.created_at : null }))
    render(<Harness />)
    await screen.findByRole('button', { name: 'Edit Alex Lee' })
    await waitFor(() => expect(screen.getByText('1 assigned task')).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alex Lee' }))
    fireEvent.change(screen.getByLabelText('Member name'), { target: { value: '  Alex Renamed  ' } })
    fireEvent.click(screen.getByLabelText('Rose'))
    fireEvent.click(screen.getByRole('button', { name: 'Save member' }))
    await screen.findByRole('button', { name: 'Edit Alex Renamed' })
    expect(updateMember).toHaveBeenCalledWith(client, 'user-1', member.id, { name: 'Alex Renamed', avatar_color: '#c85058' })
    const cardAvatars = screen.getByRole('img', { name: 'Assignees: Alex Renamed' })
    expect(cardAvatars.querySelector('.member-avatar')).toHaveStyle({ backgroundColor: '#c85058' })
    fireEvent.click(screen.getByRole('button', { name: 'Archive Alex Renamed' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit Alex Renamed' })).not.toBeInTheDocument())
    expect(screen.getByRole('img', { name: 'Assignees: Alex Renamed (Archived)' })).toBeVisible()
    expect(screen.getByText('Includes archived')).toBeVisible()
    expect(screen.queryByRole('img', { name: /Active team members:/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Alex Renamed' }))
    await waitFor(() => expect(screen.getByRole('img', { name: 'Assignees: Alex Renamed' })).toBeVisible())
    fireEvent.click(screen.getByRole('button', { name: 'Active (1)' }))
    expect(screen.getByRole('button', { name: 'Edit Alex Renamed' })).toBeEnabled()
    expect(screen.getByText('1 assigned task')).toBeVisible()
  })

  it('retains a failed create draft, reuses its ID, and blocks double submission while saving', async () => {
    vi.mocked(fetchTeamMembers).mockResolvedValue([])
    vi.mocked(fetchTasks).mockResolvedValue([])
    let finish!: (saved: ReturnType<typeof makeMember>) => void
    vi.mocked(createMember).mockRejectedValueOnce(new Error('Connection lost'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    render(<Harness />)
    await screen.findByText('Your team starts here')
    fireEvent.click(screen.getByRole('button', { name: 'Add your first member' }))
    expect(screen.getByLabelText('Member name')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Member name'), { target: { value: '  Sam Taylor  ' } })
    fireEvent.click(screen.getByLabelText('Forest'))
    const form = screen.getByRole('form', { name: 'Add team member' })
    fireEvent.submit(form)
    expect(await screen.findByText('Connection lost')).toBeVisible()
    expect(screen.getByLabelText('Member name')).toHaveValue('  Sam Taylor  ')
    expect(screen.getByLabelText('Forest')).toBeChecked()
    fireEvent.submit(form); fireEvent.submit(form)
    expect(createMember).toHaveBeenCalledTimes(2)
    expect(createMember).toHaveBeenLastCalledWith(client, 'user-1', { name: 'Sam Taylor', avatar_color: '#166b45' }, expect.any(String))
    expect(vi.mocked(createMember).mock.calls[0][3]).toBe(vi.mocked(createMember).mock.calls[1][3])
    expect([...guards].every((guard) => guard())).toBe(false)
    await act(async () => { finish(makeMember({ id: 'new-member', name: 'Sam Taylor', avatar_color: '#166b45' })) })
    expect(await screen.findByRole('button', { name: 'Edit Sam Taylor' })).toBeEnabled()
  })

  it('blocks navigation while archival is pending and preserves records after failure', async () => {
    let fail!: (error: Error) => void
    vi.mocked(archiveMember).mockReturnValue(new Promise((_, reject) => { fail = reject }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Alex Lee' }))
    expect([...guards].every((guard) => guard())).toBe(false)
    await act(async () => { fail(new Error('Could not archive member')) })
    expect(screen.getByText('Could not archive member')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Edit Alex Lee' })).toBeEnabled()
    expect(screen.getByRole('img', { name: 'Assignees: Alex Lee' })).toBeVisible()
  })
})
