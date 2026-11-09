import type { Tables } from './database'
import type { AvatarColor } from './team'

export type Label = Tables<'labels'>
export interface LabelDraft {
  name: string
  color: AvatarColor
}
