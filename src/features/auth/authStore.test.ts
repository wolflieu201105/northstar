import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { AppClient } from '../../shared/lib/supabase'
import { createAuthStore } from './authStore'
import { readRegistration, writeRegistration } from './registration'

const session = (id = 'guest-A', verified = false): Session => ({
  access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer',
  user: { id, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '2026-11-09T14:00:00Z',
    is_anonymous: !verified, ...(verified ? { email: 'alex@example.test', email_confirmed_at: '2026-11-09T14:01:00Z' } : {}) },
})
function connection(initial: Session | null = null) {
  let current = initial
  let listener: ((event: AuthChangeEvent, value: Session | null) => void) | undefined
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    signInAnonymously: vi.fn(async () => { current = session(); return { data: { session: current }, error: null } }),
    onAuthStateChange: vi.fn((callback: typeof listener) => { listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } }),
    refreshSession: vi.fn(async () => ({ data: { session: current }, error: null })),
    updateUser: vi.fn(async () => ({ data: { user: current!.user }, error: null as Error | null })),
    resend: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => { current = null; listener?.('SIGNED_OUT', null); return { error: null } }),
    signInWithPassword: vi.fn(async () => { current = session('registered-B', true); listener?.('SIGNED_IN', current); return { data: { session: current }, error: null } }),
    exchangeCodeForSession: vi.fn(async () => ({ data: { session: current }, error: null as Error | null })),
    setSession: vi.fn(async (tokens: { access_token: string; refresh_token: string }) => {
      void tokens; current = initial
      return { data: { session: current }, error: null }
    }),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  }
  const client = { auth } as unknown as AppClient
  return { auth, client, setCurrent(value: Session | null) { current = value }, emit(event: AuthChangeEvent, value: Session | null) { current = value; listener?.(event, value) } }
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState({}, '', '/') })
async function started(c: ReturnType<typeof connection>) {
  const store = createAuthStore(c.client)
  store.start()
  await waitFor(() => expect(store.getSnapshot().isLoading).toBe(false))
  return store
}
describe('native account sessions', () => {
  it('recognizes the native recovery event during a code exchange without a custom mode parameter', async () => {
    window.history.replaceState({}, '', '/?code=native-recovery')
    const recovered = session('registered-A', true)
    const c = connection(recovered)
    c.auth.exchangeCodeForSession.mockImplementationOnce(async () => {
      c.emit('PASSWORD_RECOVERY', recovered)
      return { data: { session: recovered }, error: null }
    })
    const store = await started(c)
    expect(store.getSnapshot()).toMatchObject({ recovery: true, session: recovered })
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
    store.stop()
  })
  it('consumes the SDK flow identifier so a resent PKCE link uses the correct verifier', async () => {
    window.history.replaceState({}, '', '/?auth=upgrade&code=latest-code&sb_flow_id=flow-123')
    const c = connection(session('guest-A', true))
    const store = await started(c)
    expect(c.auth.exchangeCodeForSession).toHaveBeenCalledWith('latest-code', { flowId: 'flow-123' })
    expect(window.location.search).toBe('?view=account')
    store.stop()
  })
  it('deduplicates initial anonymous entry across a StrictMode restart', async () => {
    const c = connection()
    const store = createAuthStore(c.client)
    store.start(); store.stop(); store.start()
    await waitFor(() => expect(store.getSnapshot().session?.user.id).toBe('guest-A'))
    expect(c.auth.signInAnonymously).toHaveBeenCalledOnce()
    expect(c.auth.getSession).toHaveBeenCalledOnce()
    store.stop()
  })
  it('restores a persisted session and signs out without silently starting another guest', async () => {
    const c = connection(session())
    const store = await started(c)
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
    await store.signOut()
    expect(store.getSnapshot().session).toBeNull()
    store.stop()
    const reloaded = await started(c)
    expect(reloaded.getSnapshot().session).toBeNull()
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
    await reloaded.continueAsGuest()
    expect(c.auth.signInAnonymously).toHaveBeenCalledOnce()
    reloaded.stop()
  })
  it('keeps the guest UUID and group URL throughout email linking and password setup', async () => {
    window.history.replaceState({}, '', '/?group=group-A&task=task-A')
    const c = connection(session())
    const store = await started(c)
    await store.beginRegistration('  Alex@example.test  ')
    expect(c.auth.updateUser).toHaveBeenCalledWith({ email: 'alex@example.test' }, { emailRedirectTo: expect.stringContaining('auth=upgrade') })
    expect(readRegistration()).toEqual({ userId: 'guest-A', email: 'alex@example.test' })
    await expect(store.finishRegistration('password123', 'password123')).rejects.toThrow('Confirm your email')
    expect(c.auth.updateUser).toHaveBeenCalledOnce()
    c.setCurrent(session('guest-A', true))
    await store.refresh()
    await store.finishRegistration('password123', 'password123')
    expect(store.getSnapshot().session?.user.id).toBe('guest-A')
    expect(readRegistration()).toBeNull()
    expect(window.location.search).toBe('?group=group-A&task=task-A')
    expect(c.auth.updateUser).toHaveBeenLastCalledWith({ password: 'password123' })
    expect(localStorage.getItem('northstar.pending-registration.v1')).toBeNull()
    store.stop()
  })
  it('retains non-secret registration progress on network failure and supports resend', async () => {
    const c = connection(session())
    c.auth.updateUser.mockResolvedValueOnce({ data: { user: session().user }, error: new Error('Offline') })
    const store = await started(c)
    await expect(store.beginRegistration('alex@example.test')).rejects.toThrow('Offline')
    expect(readRegistration()?.userId).toBe('guest-A')
    await store.resendConfirmation()
    expect(c.auth.resend).toHaveBeenCalledWith({ type: 'email_change', email: 'alex@example.test', options: { emailRedirectTo: expect.stringContaining('auth=upgrade') } })
    await expect(store.finishRegistration('short', 'short')).rejects.toThrow('8 characters')
    expect(JSON.stringify([...Array(localStorage.length)].map((_, index) => localStorage.getItem(localStorage.key(index)!)))).not.toContain('password')
    store.stop()
  })
  it('scrubs callback credentials before exchange and never starts a guest for a failed link', async () => {
    window.history.replaceState({}, '', '/?auth=recovery&code=secret-code&group=private#access_token=secret-access&refresh_token=secret-refresh')
    const c = connection()
    c.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: new Error('Link expired') })
    const store = createAuthStore(c.client)
    expect(window.location.href).not.toMatch(/secret|code=|token=|group=/)
    store.start()
    await waitFor(() => expect(store.getSnapshot().isLoading).toBe(false))
    expect(store.getSnapshot()).toMatchObject({ session: null, recovery: false, error: 'Link expired' })
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
    store.retry()
    await waitFor(() => expect(c.auth.getSession).toHaveBeenCalledTimes(2))
    expect(c.auth.exchangeCodeForSession).toHaveBeenCalledOnce()
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled()
    store.stop()
  })
  it('rejects a guest confirmation that authenticates a different UUID', async () => {
    writeRegistration({ userId: 'guest-A', email: 'alex@example.test' })
    window.history.replaceState({}, '', '/?auth=upgrade&code=confirmation')
    const c = connection(session())
    c.auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: session('wrong-user', true) }, error: null })
    const store = await started(c)
    expect(store.getSnapshot().session?.user.id).toBe('guest-A')
    expect(store.getSnapshot().error).toContain('another account')
    expect(c.auth.setSession).toHaveBeenCalledOnce()
    expect(c.auth.updateUser).not.toHaveBeenCalled()
    await store.refresh()
    expect(store.getSnapshot().session?.user.id).toBe('guest-A')
    expect(store.getSnapshot().error).toBeNull()
    store.stop()
  })
  it('requires a successful recovery callback, resumes password setup, and clears it on account switching', async () => {
    window.history.replaceState({}, '', '/?auth=recovery&code=recovery-code')
    const c = connection(session('registered-A', true))
    const store = await started(c)
    expect(store.getSnapshot().recovery).toBe(true)
    await expect(store.finishRecovery('password123', 'mismatch')).rejects.toThrow('do not match')
    await store.finishRecovery('password123', 'password123')
    expect(store.getSnapshot().recovery).toBe(false)
    c.emit('PASSWORD_RECOVERY', session('registered-A', true))
    expect(store.getSnapshot().recovery).toBe(true)
    c.emit('SIGNED_IN', session('registered-B', true))
    expect(store.getSnapshot().recovery).toBe(false)
    await expect(store.finishRecovery('password123', 'password123')).rejects.toThrow('recovery link')
    store.stop()
  })
  it('clears task and group filters on an Auth identity change but retains same-ID token refreshes', async () => {
    const c = connection(session())
    const store = await started(c)
    window.history.replaceState({}, '', '/?group=group-A&task=task-A&q=secret&assignee=member-A')
    c.emit('TOKEN_REFRESHED', session())
    expect(window.location.search).toContain('group-A')
    await store.signIn('b@example.test', 'password123')
    expect(store.getSnapshot().session?.user.id).toBe('registered-B')
    expect(window.location.search).toBe('?view=account')
    store.stop()
  })
})
