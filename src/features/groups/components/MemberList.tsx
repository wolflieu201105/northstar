import type { AppClient } from '../../../shared/lib/supabase'
import type { Group } from '../types'
import { useMembers } from '../hooks/useMembers'
import { removeMember, transferOwnership } from '../services/groups'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import { MemberAvatar } from '../../team/components/MemberAvatar'

interface Props { client: AppClient; userId: string; group: Group; registerGuard: RegisterNavigationGuard; onChanged: () => void; onAccount: () => void }
export function MemberList({ client, userId, group, registerGuard, onChanged, onAccount }: Props) {
  const members = useMembers(client, userId, group.id)
  const action = useAction()
  const owner = group.owner_user_id === userId
  useDraftProtection(false, action.busy, registerGuard)
  return <section className="group-panel"><h2>Group members</h2>
    {members.isLoading && <p role="status">Loading members…</p>}
    {members.error && <p role="alert">{members.error}</p>}
    <button className="text-button" disabled={members.isLoading || action.busy} onClick={members.reload}>Refresh members</button>
    <ul className="group-list">{members.items.map((member) => <li key={member.user_id} className={!member.is_active ? 'member-left' : ''}>
      <div className="member-identity"><MemberAvatar member={member.profile} /><div><strong>{member.profile.display_name}</strong><p>@{member.profile.username} · {member.is_active ? group.owner_user_id === member.user_id ? 'Owner' : 'Member' : 'Left group'}</p></div></div>
      <div className="form-actions">
        {member.user_id === userId && <button className="text-button" onClick={onAccount}>Edit my profile</button>}
        {owner && member.is_active && member.user_id !== userId && <>
          <button className="button button-secondary" disabled={action.busy} onClick={() => {
            if (!window.confirm(`Transfer ownership to ${member.profile.display_name}? You will become a regular member.`)) return
            void action.run(async () => { await transferOwnership(client, group.id, member.user_id); onChanged(); await members.reload(); return 'Ownership transferred.' })
          }}>Make owner</button>
          <button className="button button-danger-ghost" disabled={action.busy} onClick={() => {
            if (!window.confirm(`Remove ${member.profile.display_name} from this group? Their assignments will be cleared.`)) return
            void action.run(async () => { await removeMember(client, group.id, member.user_id); onChanged(); await members.reload(); return 'Member removed.' })
          }}>Remove</button>
        </>}
      </div>
    </li>)}</ul>
    <ActionFeedback {...action} />
  </section>
}
