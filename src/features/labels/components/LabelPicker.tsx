import type { Label } from '../types'
import { TaskRelationPicker } from '../../../shared/components/TaskRelationPicker'

interface LabelPickerProps {
  labels: Label[]
  linkedLabels?: Label[]
  selectedIds: string[]
  isLoading: boolean
  error: string | null
  onChange: (ids: string[]) => void
  onRetry: () => void
  onManage?: () => void
}

export function LabelPicker({ labels, linkedLabels = [], ...props }: LabelPickerProps) {
  const linked = new Set(linkedLabels.map((label) => label.id))
  const options = [...new Map([...linkedLabels, ...labels].map((label) => [label.id, label])).values()]
    .filter((label) => !label.archived_at || linked.has(label.id) || props.selectedIds.includes(label.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  return <TaskRelationPicker {...props} title="Labels" options={options} emptySelectionLabel="No labels" />
}
