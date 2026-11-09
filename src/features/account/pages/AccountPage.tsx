import type { AuthController } from '../../auth/useAuthSession'
import type { IdentityData } from '../hooks/useIdentityData'
import { useDraftProtection, type RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import { useAction } from '../../../shared/hooks/useAction'
import { ActionFeedback } from '../../../shared/components/ActionFeedback'
import { ProfileEditor } from '../components/ProfileEditor'
import { GuestRegistration } from '../components/GuestRegistration'
import { CredentialsForm } from '../components/CredentialsForm'
import { PasswordForm } from '../components/PasswordForm'

interface Props { auth: AuthController; identity: IdentityData; registerGuard: RegisterNavigationGuard; canSwitch: () => boolean; onProfileSaved: () => void }
export function AccountPage({ auth, identity, registerGuard, canSwitch, onProfileSaved }: Props) {
  const action = useAction()
  useDraftProtection(false, action.busy, registerGuard)
  const user = auth.session!.user
  const guest = Boolean(user.is_anonymous)
  const unfinished = guest || auth.pending?.userId === user.id
  return <section className="workspace-directory account-page" aria-labelledby="workspace-title">
    <header className="directory-intro"><div><span className="eyebrow">{guest ? 'Guest account' : 'Your account'}</span><h1 id="workspace-title" tabIndex={-1}>Account</h1>
      <p>{guest ? 'Register this guest to sign in from another browser.' : user.email}</p></div></header>
    {auth.error && <p className="form-error" role="alert">{auth.error}</p>}
    <div className="account-id"><label htmlFor="account-id">Account ID</label><input id="account-id" value={user.id} readOnly onFocus={(event) => event.target.select()} />
      <button className="button button-secondary" onClick={() => void action.run(async () => { if (!navigator.clipboard) throw new Error('Select the account ID and copy it using your browser.'); await navigator.clipboard.writeText(user.id); return 'Account ID copied.' })}>Copy ID</button></div>
    <div className="account-grid">
      <div>
        {identity.profile && <ProfileEditor key={user.id} profile={identity.profile} registerGuard={registerGuard} onSave={async (draft) => {
          const saved = await identity.saveProfile(draft); onProfileSaved(); return saved
        }} />}
        {identity.profileLoading && !identity.profile && <p role="status">Loading profile…</p>}
        {identity.profileError && <p role="alert">{identity.profileError} <button onClick={identity.reloadProfile}>Retry profile</button></p>}
      </div>
      <div>
        {auth.recovery ? <PasswordForm title="Choose a new password" registerGuard={registerGuard} onSubmit={auth.finishRecovery} />
          : (guest || auth.pending?.userId === user.id) ? <GuestRegistration auth={auth} registerGuard={registerGuard} /> : null}
        <CredentialsForm auth={auth} registerGuard={registerGuard} canSwitch={canSwitch} />
        <button className="button button-secondary" disabled={action.busy} onClick={() => {
          if (!canSwitch()) return
          if (unfinished && !window.confirm('Sign out of this guest? Register it first to keep access to its groups.')) return
          void action.run(auth.signOut)
        }}>Sign out</button>
      </div>
    </div>
    <ActionFeedback {...action} />
  </section>
}
