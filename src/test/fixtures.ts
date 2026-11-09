import type { TaskView } from '../features/tasks/types'
import type { TeamMember } from '../features/team/types'
import type { Label } from '../features/labels/types'
import type { TaskComment } from '../features/comments/types'
import type { TaskActivity } from '../features/activity/types'
import type { Group, GroupMember, Invitation } from '../features/groups/types'
import type { Profile } from '../features/account/types'

export function makeActivity(overrides: Partial<Pick<TaskActivity, 'id' | 'task_id' | 'group_id' | 'actor_user_id' | 'actor_name' | 'created_at'>> = {}): TaskActivity {
  return {
    id: '00000000-0000-4000-8000-000000000001', group_id: 'group-1', task_id: 'task-1', actor_user_id: 'user-1', actor_name: 'Alex',
    created_at: '2026-11-09T05:00:00.000001Z', event_type: 'task_created',
    payload: { version: 2, title: 'Prepare launch brief', status: 'todo' }, ...overrides,
  }
}
export function makeComment(overrides: Partial<TaskComment> = {}): TaskComment {
  return {
    id: '00000000-0000-4000-8000-000000000001', group_id: 'group-1', task_id: 'task-1',
    author_user_id: 'user-1', author_name: 'Alex', body: 'A useful update.', created_at: '2026-11-09T05:00:00.000001Z', ...overrides,
  }
}
export function makeLabel(overrides: Partial<Label> = {}): Label {
  return {
    id: 'label-1', group_id: 'group-1', created_by_user_id: 'user-1', name: 'Bug', color: '#20895b', archived_at: null,
    created_at: '2026-11-08T14:00:00.000Z', updated_at: '2026-11-08T14:00:00.000Z', ...overrides,
  }
}
export function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return { id: 'member-1', username: 'alex_lee', display_name: 'Alex Lee', avatar_color: null, ...overrides }
}
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { ...makeMember({ id: 'user-1' }), created_at: '2026-11-08T14:00:00Z', updated_at: '2026-11-08T14:00:00Z', ...overrides }
}
export function makeMembership(overrides: Partial<GroupMember> = {}): GroupMember {
  return { group_id: 'group-1', user_id: 'member-1', is_active: true, joined_at: '2026-11-08T14:00:00Z', left_at: null, invited_by_user_id: null, profile: makeMember(), ...overrides }
}
export function makeGroup(overrides: Partial<Group> = {}): Group {
  return { id: 'group-1', name: 'Launch', owner_user_id: 'user-1', owner_membership_active: true, created_by_user_id: 'user-1', created_by_name: 'Alex', created_at: '2026-11-08T14:00:00Z', updated_at: '2026-11-08T14:00:00Z', ...overrides }
}
export function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return { id: 'invite-1', group_id: 'group-1', group_name: 'Launch', inviter_user_id: 'user-1', inviter_name: 'Alex', recipient_user_id: 'user-2', status: 'pending', created_at: '2026-11-09T14:00:00.123456Z', expires_at: '2026-11-16T14:00:00.123456Z', responded_at: null, ...overrides }
}
export function makeTask(overrides: Partial<TaskView> = {}): TaskView {
  return {
    id: 'task-1', group_id: 'group-1', created_by_user_id: 'user-1', created_by_name: 'Alex',
    title: 'Prepare launch brief', description: 'Collect the final launch details.', status: 'todo', priority: 'normal',
    due_date: '2026-11-10', created_at: '2026-11-08T14:00:00.000Z', updated_at: '2026-11-08T14:00:00.000Z',
    assignees: [], labels: [], ...overrides,
  }
}
