import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import type { NavigationGuard } from '../../../shared/types/navigation'
import { fetchTeamMembers } from '../../team/services/team'
import { fetchLabels, createLabel, updateLabel, archiveLabel, LabelNameConflictError } from '../services/labels'
import { fetchTasks } from '../../tasks/services/tasks'
import { useWorkspaceData } from '../../workspace/useWorkspaceData'
import { useTasks } from '../../tasks/hooks/useTasks'
import { makeLabel, makeTask } from '../../../test/fixtures'
import { TaskCard } from '../../tasks/components/TaskCard'
import { LabelsPage } from './LabelsPage'

vi.mock('../../team/services/team', () => ({ fetchTeamMembers: vi.fn(), createMember: vi.fn(), updateMember: vi.fn(), archiveMember: vi.fn() }))
vi.mock('../services/labels', async (original) => ({ ...await original<typeof import('../services/labels')>(), fetchLabels: vi.fn(), createLabel: vi.fn(), updateLabel: vi.fn(), archiveLabel: vi.fn() }))
vi.mock('../../tasks/services/tasks', () => ({ fetchTasks: vi.fn() }))
vi.mock('@dnd-kit/react', () => ({ useDraggable: () => ({ ref: vi.fn(), handleRef: vi.fn(), isDragging: false }) }))
const client = {} as AppClient
const label = makeLabel()
const guards = new Set<NavigationGuard>()
const registerGuard = (guard: NavigationGuard) => { guards.add(guard); return () => { guards.delete(guard) } }
function Harness() {
  const workspace = useWorkspaceData(client, 'user-1')
  const tasks = useTasks(client, 'user-1', workspace)
  return <><LabelsPage workspace={workspace} tasks={tasks.tasks} tasksLoading={tasks.isLoading} taskError={tasks.loadError} registerGuard={registerGuard} />
    {tasks.tasks.map((task) => <TaskCard key={task.id} task={task} today={new Date()} isMoving={false} onEdit={vi.fn()} />)}</>
}
beforeEach(() => {
  vi.resetAllMocks(); guards.clear()
  vi.mocked(fetchTeamMembers).mockResolvedValue([])
  vi.mocked(fetchLabels).mockResolvedValue([label])
  vi.mocked(fetchTasks).mockResolvedValue([makeTask({ labels: [label] })])
})

describe('Label management with canonical task chips', () => {
  it('renames/recolors, archives, and restores labels without dropping task links', async () => {
    const renamed = { ...label, name: 'Feature', color: '#c9892d' }
    vi.mocked(updateLabel).mockResolvedValue(renamed)
    vi.mocked(archiveLabel).mockImplementation(async (_client, _owner, _id, archived) => ({ ...renamed, archived_at: archived ? label.created_at : null }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Bug' }))
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: '  Feature  ' } })
    fireEvent.click(screen.getByLabelText('Amber'))
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))
    await screen.findByRole('button', { name: 'Edit Feature' })
    expect(updateLabel).toHaveBeenCalledWith(client, 'user-1', label.id, { name: 'Feature', color: '#c9892d' })
    const cardChips = screen.getByRole('group', { name: 'Task labels' })
    expect(within(cardChips).getByText('Feature').closest('.label-chip')).toHaveStyle({ backgroundColor: '#c9892d', color: '#111512' })
    expect(screen.getByText('1 tagged task')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Archive Feature' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Edit Feature' })).not.toBeInTheDocument())
    expect(within(cardChips).getByText('Feature')).toBeVisible()
    expect(within(cardChips).getByText('Archived')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Archived (1)' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Feature' }))
    await waitFor(() => expect(within(cardChips).queryByText('Archived')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Active (1)' }))
    expect(screen.getByRole('button', { name: 'Edit Feature' })).toBeEnabled()
    expect(screen.getByText('1 tagged task')).toBeVisible()
  })

  it('retains failed create drafts, reuses their ID, and prevents repeated pending submissions', async () => {
    vi.mocked(fetchLabels).mockResolvedValue([])
    vi.mocked(fetchTasks).mockResolvedValue([])
    let finish!: (saved: ReturnType<typeof makeLabel>) => void
    vi.mocked(createLabel).mockRejectedValueOnce(new Error('Save failed'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first label' }))
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: '  Design  ' } })
    fireEvent.click(screen.getByLabelText('Sage'))
    const form = screen.getByRole('form', { name: 'Add label' })
    fireEvent.submit(form)
    expect(await screen.findByText('Save failed')).toBeVisible()
    expect(screen.getByLabelText('Label name')).toHaveValue('  Design  ')
    fireEvent.submit(form); fireEvent.submit(form)
    expect(createLabel).toHaveBeenCalledTimes(2)
    expect(vi.mocked(createLabel).mock.calls[0][3]).toBe(vi.mocked(createLabel).mock.calls[1][3])
    expect([...guards].every((guard) => guard())).toBe(false)
    await act(async () => { finish(makeLabel({ name: 'Design', color: '#4f8065' })) })
    expect(await screen.findByRole('button', { name: 'Edit Design' })).toBeEnabled()
  })

  it('recovers an archived-name conflict from a newer server row by offering restore', async () => {
    vi.mocked(fetchLabels).mockResolvedValue([])
    vi.mocked(fetchTasks).mockResolvedValue([])
    const archived = makeLabel({ archived_at: label.created_at })
    vi.mocked(createLabel).mockRejectedValue(new LabelNameConflictError(archived))
    vi.mocked(archiveLabel).mockResolvedValue(label)
    render(<Harness />)
    fireEvent.click(await screen.findByRole('button', { name: 'Add your first label' }))
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: 'bug' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Add label' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore existing label' }))
    await screen.findByRole('button', { name: 'Edit Bug' })
    expect(createLabel).toHaveBeenCalledOnce()
    expect(archiveLabel).toHaveBeenCalledWith(client, 'user-1', label.id, false)
    expect(screen.getByRole('button', { name: 'Active (1)' })).toBeEnabled()
  })
})
