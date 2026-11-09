import type { TaskView } from '../features/tasks/types'
import type { TeamMember } from '../features/team/types'
import type { Label } from '../features/labels/types'
import type { TaskComment } from '../features/comments/types'

export function makeComment(overrides: Partial<TaskComment> = {}): TaskComment {
  return {
    id: '00000000-0000-4000-8000-000000000001', user_id: 'user-1', task_id: 'task-1',
    body: 'A useful update.', created_at: '2026-11-09T05:00:00.000001Z', ...overrides,
  }
}

export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'label-1', user_id: 'user-1', name: 'Bug', color: '#20895b', archived_at: null,
    created_at: '2026-11-08T14:00:00.000Z', updated_at: '2026-11-08T14:00:00.000Z', ...overrides,
  }
}

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
