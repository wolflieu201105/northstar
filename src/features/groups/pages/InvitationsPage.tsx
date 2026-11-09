import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import { createInvitationStore } from '../state/invitationStore'
import { respondInvitation, revokeInvitation } from '../services/groups'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import { useActivityClock } from '../../activity/hooks/useActivityClock'
import { Timestamp } from '../../../shared/components/Timestamp'

interface Props { client: AppClient; userId: string; registerGuard: RegisterNavigationGuard; onChanged: () => Promise<void> }
export function InvitationsPage({ client, userId, registerGuard, onChanged }: Props) {
  const store = useMemo(() => createInvitationStore(client, userId), [client, userId])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [tab, setTab] = useState<'incoming' | 'sent'>('incoming')
  const action = useAction()
  const now = useActivityClock()
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  useDraftProtection(false, action.busy, registerGuard)
  const rows = state.items.filter((row) => tab === 'incoming' ? row.recipient_user_id === userId : row.recipient_user_id !== userId)
  return <section className="workspace-directory" aria-labelledby="workspace-title">
    <header className="directory-intro"><span className="eyebrow">Requests to collaborate</span><h1 id="workspace-title" tabIndex={-1}>Invitations</h1><p>Joining requires acceptance by the invited account.</p></header>
    <section className="group-panel">
      <div className="form-actions" role="group" aria-label="Invitation direction">
        <button className="button button-secondary" aria-pressed={tab === 'incoming'} disabled={action.busy} onClick={() => setTab('incoming')}>Incoming</button>
        <button className="button button-secondary" aria-pressed={tab === 'sent'} disabled={action.busy} onClick={() => setTab('sent')}>Sent in my groups</button>
        <button className="text-button" disabled={state.loading || action.busy} onClick={() => void store.load()}>Refresh invitations</button>
      </div>
      {state.loading && <p role="status">Loading invitations…</p>}
      {state.error && <p className="form-error" role="alert">{state.error} <button onClick={() => void store.load(state.failedMore)}>Retry invitations</button></p>}
      {!state.loading && !state.error && !rows.length && <p>No {tab} invitations in these results.</p>}
      <ul className="group-list">{rows.map((row) => {
        const expired = row.status === 'pending' && Date.parse(row.expires_at) <= now
        const status = expired ? 'expired' : row.status
        return <li key={row.id}><div><strong>{row.group_name ?? 'Group invitation'}</strong><p>From {row.inviter_name}</p>
          {tab === 'sent' && <p className="account-reference">To account {row.recipient_user_id}</p>}
          <p><span className="directory-status">{status}</span> · <Timestamp value={row.created_at} /></p></div>
          {status === 'pending' && <div className="form-actions">
            {tab === 'incoming' ? ([true, false] as const).map((accept) => <button key={String(accept)} className={`button button-${accept ? 'primary' : 'secondary'}`} disabled={action.busy} onClick={() => void action.run(async () => {
              const resolved = await respondInvitation(client, row.id, accept)
              store.updateInvitation(resolved); await onChanged()
              return `Invitation ${resolved.status}.${resolved.status === 'accepted' ? ' The group is available in Groups.' : ''}`
            })}>{accept ? 'Accept' : 'Decline'}</button>)
              : <button className="button button-secondary" disabled={action.busy} onClick={() => void action.run(async () => {
                const resolved = await revokeInvitation(client, row.id); store.updateInvitation(resolved); await onChanged()
                return `Invitation ${resolved.status}.`
              })}>Revoke</button>}
          </div>}
        </li>
      })}</ul>
      {state.nextCursor && <button className="button button-secondary" disabled={state.loading || action.busy} onClick={() => void store.load(true)}>Load more invitations</button>}
      <ActionFeedback {...action} />
    </section>
  </section>
}
