import { LABEL_NAME_MAX_LENGTH, type LabelDraft } from './types'
import { AVATAR_COLORS } from '../team/types'

export function normalizeLabelDraft(draft: LabelDraft): LabelDraft {
  const name = draft.name.trim()
  if (!name || name.length > LABEL_NAME_MAX_LENGTH) throw new Error(`Label names must contain 1–${LABEL_NAME_MAX_LENGTH} characters.`)
  if (!AVATAR_COLORS.includes(draft.color)) throw new Error('Choose an available label color.')
  return { name, color: draft.color }
}

export const labelNameKey = (name: string) => name.trim().toLowerCase()
