import type { TaskView } from '../types/task'
import type { TeamMember } from '../types/team'

export function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'member-1', user_id: 'user-1', name: 'Alex Lee', avatar_color: null, archived_at: null,
    created_at: '2026-11-08T14:00:00.000Z', updated_at: '2026-11-08T14:00:00.000Z', ...overrides,
  }
}

export function makeTask(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 'task-1',
    user_id: 'user-1',
    title: 'Prepare launch brief',
    description: 'Collect the final launch details.',
    status: 'todo',
    priority: 'normal',
    due_date: '2026-11-10',
    created_at: '2026-11-08T14:00:00.000Z',
    updated_at: '2026-11-08T14:00:00.000Z',
    assignees: [],
    labels: [],
    ...overrides,
  }
}
