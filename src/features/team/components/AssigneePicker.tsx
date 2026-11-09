import type { TeamMember } from '../types'
import { TaskRelationPicker } from '../../../shared/components/TaskRelationPicker'

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
  const active = new Set(members.map((member) => member.id))
  const options = [...new Map([...assignedMembers, ...members].map((member) => [member.id, member])).values()]
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .map((member) => ({ id: member.id, name: `${member.display_name} (@${member.username})`,
      color: member.avatar_color, archived_at: active.has(member.id) ? null : 'unavailable' }))
  for (const id of props.selectedIds) {
    if (!options.some((option) => option.id === id)) {
      options.push({ id, name: `Account ${id}`, color: null, archived_at: 'unavailable' })
    }
  }
  return <TaskRelationPicker {...props} title="Assignees" options={options} manageLabel="Manage members" unavailableLabel="Unavailable" emptySelectionLabel="Unassigned" />
}
