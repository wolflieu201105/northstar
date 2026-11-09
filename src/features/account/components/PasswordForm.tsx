import { useState } from 'react'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'

interface Props { title: string; onSubmit: (password: string, confirmation: string) => Promise<void>; registerGuard?: RegisterNavigationGuard }
export function PasswordForm({ title, onSubmit, registerGuard }: Props) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const action = useAction()
  useDraftProtection(Boolean(password || confirmation), action.busy, registerGuard)
  return <form aria-label={title} className="account-form" onSubmit={(event) => { event.preventDefault(); void action.run(async () => {
    await onSubmit(password, confirmation); setPassword(''); setConfirmation('')
    return 'Password saved.'
  }) }}>
    <h2>{title}</h2>
    <label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} disabled={action.busy} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>Confirm password<input type="password" autoComplete="new-password" required value={confirmation} disabled={action.busy} onChange={(event) => setConfirmation(event.target.value)} /></label>
    <button className="button button-primary" disabled={action.busy}>{action.busy ? 'Saving…' : 'Save password'}</button>
    <ActionFeedback {...action} />
  </form>
}
