import { useState } from 'react'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import type { AuthController } from '../../auth/useAuthSession'

interface Props {
  auth: AuthController
  registerGuard?: RegisterNavigationGuard
  canSwitch?: () => boolean
}
export function CredentialsForm({ auth, registerGuard, canSwitch = () => true }: Props) {
  const [mode, setMode] = useState<'login' | 'recovery'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const action = useAction()
  const guest = Boolean(auth.session?.user.is_anonymous || (auth.session && auth.pending?.userId === auth.session.user.id))
  // Account switching already checks all workspace drafts before submitting.
  useDraftProtection(false, action.busy, registerGuard)
  return <form aria-label={mode === 'login' ? 'Sign in to an existing account' : 'Request password recovery'} className="account-form" onSubmit={(event) => {
    event.preventDefault()
    if (mode === 'login' && !canSwitch()) return
    void action.run(async () => {
      if (mode === 'recovery') { await auth.requestRecovery(email); return 'If this email has an account, a recovery link will arrive. Open it in this browser.' }
      if (guest && !acknowledged) throw new Error('Confirm you understand what happens to this guest account.')
      await auth.signIn(email, password)
      setPassword('')
      return 'Signed in.'
    })
  }}>
    <h2>{mode === 'login' ? auth.session ? 'Switch account' : 'Sign in' : 'Recover your password'}</h2>
    {guest && mode === 'login' && <label className="checkbox-label"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} disabled={action.busy} />
      I understand this guest’s groups stay with this guest. Register it first to keep access; signing into an existing account does not merge work.</label>}
    <label>Email<input type="email" autoComplete="email" required value={email} disabled={action.busy} onChange={(event) => setEmail(event.target.value)} /></label>
    {mode === 'login' && <label>Password<input type="password" autoComplete="current-password" required value={password} disabled={action.busy} onChange={(event) => setPassword(event.target.value)} /></label>}
    <div className="form-actions">
      <button className="button button-primary" disabled={action.busy || (guest && mode === 'login' && !acknowledged)}>{action.busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Send recovery link'}</button>
      <button type="button" className="text-button" disabled={action.busy} onClick={() => { setMode(mode === 'login' ? 'recovery' : 'login'); setPassword('') }}>{mode === 'login' ? 'Forgot password?' : 'Back to sign in'}</button>
    </div>
    <ActionFeedback {...action} />
  </form>
}
