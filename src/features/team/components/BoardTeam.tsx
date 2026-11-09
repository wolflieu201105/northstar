import { Users } from 'lucide-react'
import type { TeamMember } from '../types'
import { MemberAvatarStack } from './MemberAvatar'

interface BoardTeamProps { members: TeamMember[]; isLoading: boolean; error: string | null; onRetry: () => void; onManage: () => void }
export function BoardTeam({ members, isLoading, error, onRetry, onManage }: BoardTeamProps) {
  return <section className="board-team" aria-label="Group members">
    <div className="board-team-main"><span className="team-strip-icon"><Users size={18} aria-hidden="true" /></span>
      <div><h2>Members</h2>
        {isLoading ? <p role="status">Loading members…</p> : error ? <p role="alert">Members could not be refreshed. <button type="button" className="text-button" onClick={onRetry}>Retry members</button></p>
          : <p>{members.length} active {members.length === 1 ? 'member' : 'members'}</p>}
      </div>
      {members.length > 0 && <MemberAvatarStack members={members} limit={5} label="Active group members" />}
    </div>
    <button className="button button-secondary" type="button" onClick={onManage}>Manage members</button>
  </section>
}
