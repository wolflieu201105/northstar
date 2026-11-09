import type { Label } from '../types'
import { LabelChip } from './LabelChip'

export function TaskLabelChips({ labels }: { labels: Label[] }) {
  if (!labels.length) return null
  return <div className="task-label-chips" role="group" aria-label="Task labels">
    {labels.slice(0, 2).map((label) => <LabelChip key={label.id} label={label} />)}
    {labels.length > 2 && <details className="label-overflow">
      <summary aria-label={`Show ${labels.length - 2} more labels`}>+{labels.length - 2}</summary>
      <div className="label-overflow-list">{labels.slice(2).map((label) => <LabelChip key={label.id} label={label} />)}</div>
    </details>}
  </div>
}
