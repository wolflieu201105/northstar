import { AVATAR_COLORS, MEMBER_NAME_MAX_LENGTH, type TeamMemberDraft } from '../types/team'

export function normalizeMemberDraft(draft: TeamMemberDraft): TeamMemberDraft {
  const name = draft.name.trim()
  if (!name || name.length > MEMBER_NAME_MAX_LENGTH) throw new Error(`Member names must contain 1–${MEMBER_NAME_MAX_LENGTH} characters.`)
  if (draft.avatar_color !== null && !AVATAR_COLORS.includes(draft.avatar_color)) throw new Error('Choose an available avatar color.')
  return { name, avatar_color: draft.avatar_color }
}

export function memberInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join('').toLocaleUpperCase() || '?'
}

export function avatarTextColor(color: string | null) {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return '#ffffff'
  const channels = [1, 3, 5].map((offset) => {
    const channel = parseInt(color.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return luminance > 0.179 ? '#111512' : '#ffffff'
}
