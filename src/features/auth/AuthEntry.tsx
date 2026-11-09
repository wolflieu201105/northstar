import type { AuthController } from './useAuthSession'
import { CredentialsForm } from '../account/components/CredentialsForm'
import { useAction } from '../../shared/hooks/useAction'
import { ActionFeedback } from '../../shared/components/ActionFeedback'

export function AuthEntry({ auth }: { auth: AuthController }) {
  const action = useAction()
  return <main className="auth-entry">
    <span className="eyebrow">Northstar</span><h1>Your work, together.</h1>
    {auth.error && <p className="form-error" role="alert">{auth.error} <button type="button" onClick={auth.retry}>Retry session</button></p>}
    <CredentialsForm auth={auth} />
    <section className="account-form"><h2>Start a new account</h2><p>Try Northstar as a guest, then register from Account to keep your work.</p>
      <button className="button button-secondary" disabled={action.busy} onClick={() => void action.run(auth.continueAsGuest)}>{action.busy ? 'Starting…' : 'Continue as guest'}</button>
      <ActionFeedback {...action} />
    </section>
  </main>
}
