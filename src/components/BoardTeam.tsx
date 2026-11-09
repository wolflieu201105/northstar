import { Users } from 'lucide-react'
import type { TeamMember } from '../types/team'
import { MemberAvatarStack } from './MemberAvatar'

interface BoardTeamProps {
  members: TeamMember[]
  isLoading: boolean
  error: string | null
  onRetry: () => void
  onManage: () => void
}

export function BoardTeam({ members, isLoading, error, onRetry, onManage }: BoardTeamProps) {
  const active = members.filter((member) => !member.archived_at).sort((a, b) => a.name.localeCompare(b.name))
  return <section className="board-team" aria-label="Workspace team">
    <div className="board-team-main"><span className="team-strip-icon"><Users size={18} aria-hidden="true" /></span>
      <div><h2>Team</h2>
        {isLoading ? <p role="status">Loading members…</p> : error ? <p role="alert">Team could not be refreshed. <button type="button" className="text-button" onClick={onRetry}>Retry team</button></p>
          : <p>{active.length ? `${active.length} active ${active.length === 1 ? 'member' : 'members'}` : 'Add profiles to assign your work.'}</p>}
      </div>
      {active.length > 0 && <MemberAvatarStack members={active} limit={5} label="Active team members" />}
    </div>
    <button className="button button-secondary" type="button" onClick={onManage}>{!isLoading && !error && active.length === 0 ? 'Add team members' : 'Manage team'}</button>
  </section>
}
