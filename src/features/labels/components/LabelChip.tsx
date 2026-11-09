import { avatarTextColor } from '../../team/utils'
import type { Label } from '../types'

export function LabelChip({ label }: { label: Pick<Label, 'name' | 'color'> & Partial<Pick<Label, 'archived_at'>> }) {
  return <span className={`label-chip${label.archived_at ? ' is-archived' : ''}`}
    style={{ backgroundColor: label.color, color: avatarTextColor(label.color) }}>
    <span>{label.name}</span>{label.archived_at && <small>Archived</small>}
  </span>
}
