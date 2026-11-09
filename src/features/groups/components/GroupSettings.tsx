import { useState } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import type { Group } from '../types'
import { deleteGroup, leaveGroup, renameGroup } from '../services/groups'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'

interface Props { client: AppClient; userId: string; group: Group; registerGuard: RegisterNavigationGuard; onChanged: () => void; onMembers: () => void }
export function GroupSettings({ client, userId, group, registerGuard, onChanged, onMembers }: Props) {
  const [name, setName] = useState(group.name)
  const [savedName, setSavedName] = useState(group.name)
  const [observedName, setObservedName] = useState(group.name)
  const action = useAction()
  if (group.name !== observedName) {
    setObservedName(group.name)
    if (name === savedName && !action.busy) { setName(group.name); setSavedName(group.name) }
  }
  const owner = group.owner_user_id === userId
  useDraftProtection(name !== savedName, action.busy, registerGuard)
  return <section className="group-panel"><h2>Manage {group.name}</h2>
    <form aria-label="Rename group" className="inline-form" onSubmit={(event) => { event.preventDefault(); void action.run(async () => {
      const row = await renameGroup(client, group.id, name); setName(row.name); setSavedName(row.name); onChanged(); return 'Group renamed.'
    }) }}>
      <label>Group name<input required maxLength={80} value={name} disabled={action.busy} onChange={(event) => setName(event.target.value)} /></label>
      <button className="button button-secondary" disabled={action.busy || name === savedName}>Rename group</button>
    </form>
    <div className="form-actions"><button className="button button-secondary" disabled={action.busy} onClick={onMembers}>Manage members</button>
      <button className="button button-danger-ghost" disabled={action.busy || owner} onClick={() => {
        if (!window.confirm('Leave this group? You will need another invitation to return.')) return
        void action.run(async () => { await leaveGroup(client, group.id); onChanged(); return 'You left this group.' })
      }}>Leave group</button>
      {owner && <button className="button button-danger-ghost" disabled={action.busy} onClick={() => {
        if (!window.confirm(`Delete “${group.name}” and all its tasks, labels, comments, and history? This cannot be undone.`)) return
        void action.run(async () => { await deleteGroup(client, group.id); onChanged(); return 'Group deleted.' })
      }}>Delete group</button>}
    </div>
    {owner && <p className="detail-hint">To leave, transfer ownership to another active member in Members, or delete the group.</p>}
    <ActionFeedback {...action} />
  </section>
}
