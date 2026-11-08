import type { Task } from '../types/task'

export function makeTask(overrides: Partial<Task> = {}): Task {
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
    ...overrides,
  }
}
