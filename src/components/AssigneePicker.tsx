import type { TeamMember } from '../types/team'
import { TaskRelationPicker } from './TaskRelationPicker'

interface AssigneePickerProps {
  members: TeamMember[]
  assignedMembers?: TeamMember[]
  selectedIds: string[]
  isLoading: boolean
  error: string | null
  onChange: (ids: string[]) => void
  onRetry: () => void
  onManage?: () => void
}

export function AssigneePicker({ members, assignedMembers = [], ...props }: AssigneePickerProps) {
  const linked = new Set(assignedMembers.map((member) => member.id))
  const options = [...new Map([...assignedMembers, ...members].map((member) => [member.id, member])).values()]
    .filter((member) => !member.archived_at || linked.has(member.id) || props.selectedIds.includes(member.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((member) => ({ ...member, color: member.avatar_color }))
  return <TaskRelationPicker {...props} title="Assignees" options={options} manageLabel="Manage team" emptySelectionLabel="Unassigned" />
}
