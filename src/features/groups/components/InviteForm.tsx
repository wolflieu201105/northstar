import { useRef, useState } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import type { AccountIdentity } from '../../account/types'
import { lookupTarget, sendInvitation } from '../services/groups'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import { MemberAvatar } from '../../team/components/MemberAvatar'

interface Props { client: AppClient; groupId: string; registerGuard: RegisterNavigationGuard; onSent: () => void }
export function InviteForm({ client, groupId, registerGuard, onSent }: Props) {
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<AccountIdentity | null>(null)
  const intent = useRef<{ recipient: string; id: string } | null>(null)
  const action = useAction()
  useDraftProtection(Boolean(query.trim()), action.busy, registerGuard)
  return <section className="group-panel">
    <h2>Invite an account</h2><p>Find a registered user or guest by their exact unique username or account ID. They must accept before joining.</p>
    <form aria-label="Find invitation recipient" className="inline-form" onSubmit={(event) => { event.preventDefault(); setTarget(null); void action.run(async () => {
      const found = await lookupTarget(client, groupId, query)
      setTarget(found)
      if (!found) return 'No account found. Check the username or account ID.'
    }) }}>
      <label>Username or account ID<input required value={query} disabled={action.busy} onChange={(event) => { setQuery(event.target.value); setTarget(null) }} /></label>
      <button className="button button-secondary" disabled={action.busy || !query.trim()}>Find account</button>
    </form>
    {target && <div className="invitation-preview"><MemberAvatar member={target} /><div><strong>{target.display_name}</strong><p>@{target.username}</p><small>{target.id}</small></div>
      <button type="button" className="button button-primary" disabled={action.busy} onClick={() => void action.run(async () => {
        if (intent.current?.recipient !== target.id) intent.current = { recipient: target.id, id: crypto.randomUUID() }
        const saved = await sendInvitation(client, groupId, target.id, intent.current.id)
        intent.current = null
        setTarget(null); setQuery(''); onSent()
        return `Invitation ${saved.status}. View it in Invitations.`
      })}>Send invitation</button></div>}
    <ActionFeedback {...action} />
  </section>
}
