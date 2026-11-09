import { avatarTextColor, memberInitials } from '../lib/teamUtils'
import type { TeamMember } from '../types/team'

type AvatarMember = Pick<TeamMember, 'name' | 'avatar_color'> & Partial<Pick<TeamMember, 'archived_at'>>

export function MemberAvatar({ member, decorative = false }: { member: AvatarMember; decorative?: boolean }) {
  const label = `${member.name}${member.archived_at ? ' (Archived)' : ''}`
  return <span className={`member-avatar${member.archived_at ? ' is-archived' : ''}`}
    style={{ backgroundColor: member.avatar_color ?? 'var(--accent-dark)', color: avatarTextColor(member.avatar_color) }}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : label} aria-hidden={decorative ? true : undefined} title={label}>
    {memberInitials(member.name)}
  </span>
}

export function MemberAvatarStack({ members, limit = 3, label = 'Assignees' }: { members: TeamMember[]; limit?: number; label?: string }) {
  const names = members.map((member) => `${member.name}${member.archived_at ? ' (Archived)' : ''}`).join(', ')
  return <span className="member-avatar-stack" role="img" aria-label={`${label}: ${names}`} title={names}>
    {members.slice(0, limit).map((member) => <MemberAvatar key={member.id} member={member} decorative />)}
    {members.length > limit && <span className="member-avatar avatar-overflow" aria-hidden="true">+{members.length - limit}</span>}
  </span>
}
