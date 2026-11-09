import { useRef, useState } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import type { IdentityData } from '../../account/hooks/useIdentityData'
import type { Group } from '../types'
import { createGroup } from '../services/groups'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import { GroupSettings } from '../components/GroupSettings'

interface Props { client: AppClient; userId: string; identity: IdentityData; selected?: Group; registerGuard: RegisterNavigationGuard; onSelect: (id: string) => boolean; onMembers: () => void }
export function GroupsPage({ client, userId, identity, selected, registerGuard, onSelect, onMembers }: Props) {
  const [name, setName] = useState('')
  const intents = useRef(new Map<string, string>())
  const action = useAction()
  useDraftProtection(Boolean(name.trim()), action.busy, registerGuard)
  return <section className="workspace-directory" aria-labelledby="workspace-title">
    <header className="directory-intro"><span className="eyebrow">Your workspaces</span><h1 id="workspace-title" tabIndex={-1}>Groups</h1><p>Switch between groups or create one and invite people to work together.</p></header>
    <section className="group-panel"><h2>Create a group</h2>
      <form aria-label="Create group" className="inline-form" onSubmit={(event) => { event.preventDefault(); void action.run(async () => {
        const key = name.trim()
        const id = intents.current.get(key) ?? crypto.randomUUID()
        intents.current.set(key, id)
        const group = await createGroup(client, name, id)
        intents.current.delete(key); setName(''); await identity.reloadGroups()
        return `Created ${group.name}. Select it below to open its board.`
      }) }}><label>New group name<input required maxLength={80} disabled={action.busy} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <button className="button button-primary" disabled={action.busy || !name.trim()}>Create group</button></form>
      <ActionFeedback {...action} />
    </section>
    <section className="group-panel"><h2>Joined groups</h2>
      <button className="text-button" disabled={identity.groupsLoading || action.busy} onClick={identity.reloadGroups}>Refresh groups</button>
      {identity.groupsLoading && <p role="status">Loading groups…</p>}
      {identity.groupsError && <p className="form-error" role="alert">{identity.groupsError}</p>}
      {!identity.groupsLoading && !identity.groupsError && !identity.groups.length && <p>No groups yet. Create one or accept an invitation.</p>}
      <ul className="group-list">{identity.groups.map((group) => <li key={group.id}><div><strong>{group.name}</strong><p>{group.owner_user_id === userId ? 'Owner' : 'Member'}</p></div>
        <button className="button button-secondary" disabled={action.busy} onClick={() => onSelect(group.id)}>Open {group.name}</button></li>)}</ul>
    </section>
    {selected && <GroupSettings key={selected.id} client={client} userId={userId} group={selected} registerGuard={registerGuard} onChanged={identity.reloadGroups} onMembers={onMembers} />}
  </section>
}
