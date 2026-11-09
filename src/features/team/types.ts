import type { AccountIdentity } from '../account/types'

/** Assignees are real accounts, resolved through accepted group membership. */
export type TeamMember = AccountIdentity
export const AVATAR_COLORS = ['#20895b', '#166b45', '#4f8065', '#505a54', '#c9892d', '#c85058'] as const
export type AvatarColor = (typeof AVATAR_COLORS)[number]
export const AVATAR_COLOR_NAMES: Record<AvatarColor, string> = {
  '#20895b': 'Green', '#166b45': 'Forest', '#4f8065': 'Sage',
  '#505a54': 'Charcoal', '#c9892d': 'Amber', '#c85058': 'Rose',
}
export const MEMBER_NAME_MAX_LENGTH = 80
