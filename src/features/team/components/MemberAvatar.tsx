import { avatarTextColor, memberInitials } from '../utils'
import type { TeamMember } from '../types'

type AvatarMember = Pick<TeamMember, 'display_name' | 'avatar_color'> & Partial<Pick<TeamMember, 'username'>>
export function MemberAvatar({ member, decorative = false }: { member: AvatarMember; decorative?: boolean }) {
  const label = `${member.display_name}${member.username ? ` (@${member.username})` : ''}`
  return <span className="member-avatar"
    style={{ backgroundColor: member.avatar_color ?? 'var(--accent-dark)', color: avatarTextColor(member.avatar_color) }}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative ? true : undefined} title={label}>
    {memberInitials(member.display_name)}
  </span>
}
export function MemberAvatarStack({ members, limit = 3, label = 'Assignees' }: { members: TeamMember[]; limit?: number; label?: string }) {
  const names = members.map((member) => `${member.display_name} (@${member.username})`).join(', ')
  return <span className="member-avatar-stack" role="img" aria-label={`${label}: ${names}`} title={names}>
    {members.slice(0, limit).map((member) => <MemberAvatar key={member.id} member={member} decorative />)}
    {members.length > limit && <span className="member-avatar avatar-overflow" aria-hidden="true">+{members.length - limit}</span>}
  </span>
}
