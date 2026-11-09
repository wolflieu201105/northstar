import type { Tables } from '../../shared/types/database'
import type { AvatarColor } from '../team/types'

export type Label = Tables<'labels'>
export const LABEL_NAME_MAX_LENGTH = 40
export interface LabelDraft {
  name: string
  color: AvatarColor
}
