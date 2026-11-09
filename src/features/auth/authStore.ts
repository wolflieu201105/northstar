import type { Session } from '@supabase/supabase-js'
import type { AppClient } from '../../shared/lib/supabase'
import { observable } from '../../shared/state/observable'
import { callbackUrl, captureAuthCallback, exchangeAuthCallback } from './callback'
import { emailVerified, readRegistration, validatePassword, writeRegistration, type PendingRegistration } from './registration'

interface AuthState {
  session: Session | null
  isLoading: boolean
  error: string | null
  recovery: boolean
  pending: PendingRegistration | null
}
const SIGNED_OUT = 'northstar.signed-out'
const RECOVERY = 'northstar.recovery'
function flag(key: string, enabled?: boolean): boolean {
  try {
    if (enabled === true) sessionStorage.setItem(key, '1')
    if (enabled === false) sessionStorage.removeItem(key)
    return sessionStorage.getItem(key) === '1'
  } catch { return false }
}
function recoveryAccount(value?: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(RECOVERY)
    else if (value !== undefined) sessionStorage.setItem(RECOVERY, value)
    return sessionStorage.getItem(RECOVERY)
  } catch { return null }
}
function clearWorkspaceUrl() {
  const url = new URL(window.location.href)
  for (const key of ['group', 'task', 'q', 'priority', 'assignee', 'label']) url.searchParams.delete(key)
  url.searchParams.set('view', 'account')
  window.history.replaceState({}, '', url.pathname + url.search)
}
export function createAuthStore(client: AppClient) {
  let callback = captureAuthCallback()
  const state = observable<AuthState>({ session: null, isLoading: true, error: null, recovery: false, pending: readRegistration() })
  let initialization: Promise<void> | null = null
  let initialized = false
  let refs = 0
  let unsubscribe: (() => void) | undefined
  let checkingCallback = Boolean(callback)
  let callbackRecovery = false
  function acceptSession(session: Session | null) {
    const previous = state.getSnapshot().session
    if (initialized && previous?.user.id !== session?.user.id) clearWorkspaceUrl()
    state.update({ session, recovery: Boolean(session && recoveryAccount() === session.user.id) })
  }
  async function initialize() {
    try {
      const restored = await client.auth.getSession()
      if (restored.error) throw restored.error
      let session = restored.data.session
      if (callback) {
        const pending = state.getSnapshot().pending
        const expectedId = callback.mode === 'upgrade' ? pending?.userId ?? session?.user.id : null
        try {
          const completed = await exchangeAuthCallback(client, callback)
          const next = completed.session
          if (expectedId && next?.user.id !== expectedId) {
            if (session) await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
            else await client.auth.signOut({ scope: 'local' })
            throw new Error('This confirmation belongs to another account. Return to the guest that started registration.')
          }
          session = next
          if (completed.recovery || callbackRecovery) { recoveryAccount(session?.user.id ?? null); state.update({ recovery: Boolean(session) }) }
        } catch (error) {
          state.update({ error: error instanceof Error ? error.message : 'The email link could not be used.' })
          // A failed callback must never silently start a different guest.
          flag(SIGNED_OUT, !session)
        }
      } else if (!session && !flag(SIGNED_OUT)) {
        const guest = await client.auth.signInAnonymously()
        if (guest.error) throw guest.error
        session = guest.data.session
      }
      acceptSession(session)
    } catch (error) {
      state.update({ error: error instanceof Error ? error.message : 'Sign-in failed.' })
      initialization = null
    } finally {
      callback = null
      checkingCallback = false
      initialized = true
      state.update({ isLoading: false })
    }
  }
  async function refresh() {
    const { data, error } = await client.auth.refreshSession()
    if (error) throw error
    acceptSession(data.session)
    if (data.session) state.update({ error: null })
    return data.session
  }
  return {
    ...state,
    start() {
      if (++refs === 1) {
        const { data } = client.auth.onAuthStateChange((event, session) => {
          if (checkingCallback) { if (event === 'PASSWORD_RECOVERY') callbackRecovery = true; return }
          if (event === 'PASSWORD_RECOVERY') { recoveryAccount(session?.user.id ?? null); state.update({ recovery: Boolean(session) }) }
          if (event === 'SIGNED_OUT') { flag(SIGNED_OUT, true); recoveryAccount(null); state.update({ recovery: false }) }
          acceptSession(session)
        })
        unsubscribe = () => data.subscription.unsubscribe()
      }
      initialization ??= initialize()
    },
    stop() { if (--refs === 0) { unsubscribe?.(); unsubscribe = undefined } },
    retry() { state.update({ isLoading: true, error: null }); initialization = initialize() },
    async continueAsGuest() {
      const { data, error } = await client.auth.signInAnonymously()
      if (error) throw error
      flag(SIGNED_OUT, false)
      recoveryAccount(null)
      state.update({ recovery: false, error: null })
      acceptSession(data.session)
    },
    async signIn(email: string, password: string) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      flag(SIGNED_OUT, false)
      recoveryAccount(null)
      state.update({ recovery: false, error: null })
      acceptSession(data.session)
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) throw error
      flag(SIGNED_OUT, true)
      recoveryAccount(null)
      state.update({ recovery: false })
      acceptSession(null)
    },
    refresh,
    async beginRegistration(email: string) {
      const current = state.getSnapshot().session
      if (!current?.user.is_anonymous && !state.getSnapshot().pending) throw new Error('Registration starts from your current guest account.')
      if (!current) throw new Error('Continue as a guest before registering.')
      const pending = { userId: current.user.id, email: email.trim().toLowerCase() }
      // Persist only non-secret progress, including when the response is lost.
      writeRegistration(pending)
      state.update({ pending })
      const { error } = await client.auth.updateUser({ email: pending.email }, { emailRedirectTo: callbackUrl('upgrade') })
      if (error) throw error
      const session = await refresh()
      if (session?.user.id !== pending.userId) throw new Error('Your account changed. Registration was stopped.')
    },
    async resendConfirmation() {
      const pending = state.getSnapshot().pending
      if (!pending || state.getSnapshot().session?.user.id !== pending.userId) throw new Error('Return to the guest that started registration.')
      const { error } = await client.auth.resend({ type: 'email_change', email: pending.email, options: { emailRedirectTo: callbackUrl('upgrade') } })
      if (error) throw error
    },
    async finishRegistration(password: string, confirmation: string) {
      validatePassword(password, confirmation)
      const pending = state.getSnapshot().pending
      const current = await refresh()
      if (!pending || !current || !emailVerified(current.user, pending)) throw new Error('Confirm your email before setting a password.')
      const { data, error } = await client.auth.updateUser({ password })
      if (error) throw error
      if (data.user.id !== pending.userId) throw new Error('Your account changed. Registration was stopped.')
      writeRegistration(null)
      state.update({ pending: null })
      await refresh()
    },
    async requestRecovery(email: string) {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl('recovery') })
      if (error) throw error
    },
    async finishRecovery(password: string, confirmation: string) {
      if (!state.getSnapshot().recovery) throw new Error('Open the password recovery link first.')
      validatePassword(password, confirmation)
      const expectedId = recoveryAccount()
      const current = await refresh()
      if (!current || current.user.id !== expectedId) throw new Error('Your account changed. Open a new recovery link.')
      const { error } = await client.auth.updateUser({ password })
      if (error) throw error
      recoveryAccount(null)
      state.update({ recovery: false })
      await refresh()
    },
  }
}
export type AuthStore = ReturnType<typeof createAuthStore>
