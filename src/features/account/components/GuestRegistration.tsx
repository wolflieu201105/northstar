import { useState } from 'react'
import type { AuthController } from '../../auth/useAuthSession'
import { emailVerified } from '../../auth/registration'
import { useAction } from '../../../shared/hooks/useAction'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import { PasswordForm } from './PasswordForm'

export function GuestRegistration({ auth, registerGuard }: { auth: AuthController; registerGuard: RegisterNavigationGuard }) {
  const pending = auth.pending?.userId === auth.session?.user.id ? auth.pending : null
  const [email, setEmail] = useState(pending?.email ?? '')
  const action = useAction()
  useDraftProtection(Boolean(email.trim() && email.trim().toLowerCase() !== pending?.email), action.busy, registerGuard)
  if (pending && auth.session && emailVerified(auth.session.user, pending)) return <PasswordForm title="Finish registering this account" registerGuard={registerGuard} onSubmit={auth.finishRegistration} />
  return <section className="account-form">
    <h2>Register this guest</h2>
    <p>Keep your account ID, groups, tasks, and comments. Supabase may ask you to confirm your email before setting a password.</p>
    {pending && <div className="registration-progress">
      <p>Registration started for <strong>{pending.email}</strong>. Open the confirmation email in this browser, then return here.</p>
      <div className="form-actions">
        <button className="button button-secondary" disabled={action.busy} onClick={() => void action.run(async () => { await auth.refresh(); return 'Account refreshed. If email is confirmed, password setup will appear.' })}>I’ve confirmed my email</button>
        <button className="text-button" disabled={action.busy} onClick={() => void action.run(async () => { await auth.resendConfirmation(); return 'Confirmation email requested.' })}>Resend confirmation</button>
      </div>
    </div>}
    <form aria-label="Link email for registration" onSubmit={(event) => { event.preventDefault(); void action.run(async () => { await auth.beginRegistration(email); return 'Check your email for confirmation, then set a password here.' }) }}>
      <label>Email<input type="email" autoComplete="email" required value={email} disabled={action.busy} onChange={(event) => setEmail(event.target.value)} /></label>
      <button className="button button-primary" disabled={action.busy}>{action.busy ? 'Please wait…' : pending ? 'Update registration email' : 'Register current guest'}</button>
    </form>
    <ActionFeedback {...action} />
  </section>
}
