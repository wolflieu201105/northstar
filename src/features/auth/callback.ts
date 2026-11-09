import type { EmailOtpType } from '@supabase/supabase-js'
import type { AppClient } from '../../shared/lib/supabase'

export interface AuthCallback {
  mode: 'upgrade' | 'recovery' | null
  code: string | null
  flowId: string | null
  accessToken: string | null
  refreshToken: string | null
  tokenHash: string | null
  type: string | null
  error: string | null
}
export function callbackUrl(mode: 'upgrade' | 'recovery') {
  const url = new URL(window.location.pathname, window.location.origin)
  url.searchParams.set('view', 'account')
  url.searchParams.set('auth', mode)
  return url.href
}
/** Consume credentials once, before the workspace can copy a URL into history. */
export function captureAuthCallback(): AuthCallback | null {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.slice(1))
  const get = (key: string) => url.searchParams.get(key) ?? hash.get(key)
  const mode = get('auth') === 'recovery' || get('type') === 'recovery' ? 'recovery' : get('auth') === 'upgrade' ? 'upgrade' : null
  const callback: AuthCallback = {
    mode, code: get('code'), flowId: get('sb_flow_id'), accessToken: get('access_token'), refreshToken: get('refresh_token'),
    tokenHash: get('token_hash'), type: get('type'), error: get('error_description') ?? get('error'),
  }
  if (!callback.code && !callback.accessToken && !callback.tokenHash && !callback.error && !mode) return null
  for (const key of ['code', 'sb_flow_id', 'access_token', 'refresh_token', 'token_hash', 'type', 'error', 'error_description', 'error_code', 'auth', 'expires_at', 'expires_in', 'token_type']) url.searchParams.delete(key)
  for (const key of ['group', 'task', 'q', 'priority', 'assignee', 'label']) url.searchParams.delete(key)
  url.searchParams.set('view', 'account')
  url.hash = ''
  window.history.replaceState({}, '', url.pathname + url.search)
  return callback
}
export async function exchangeAuthCallback(client: AppClient, callback: AuthCallback) {
  if (callback.error) throw new Error('This email link could not be used. It may have expired. Request a new link.')
  if (callback.code) {
    const result = await client.auth.exchangeCodeForSession(callback.code, callback.flowId ? { flowId: callback.flowId } : undefined)
    if (result.error) throw result.error
    return { session: result.data.session, recovery: callback.mode === 'recovery' }
  }
  if (callback.accessToken && callback.refreshToken) {
    const result = await client.auth.setSession({ access_token: callback.accessToken, refresh_token: callback.refreshToken })
    if (result.error) throw result.error
    return { session: result.data.session, recovery: callback.mode === 'recovery' }
  }
  if (callback.tokenHash && ['recovery', 'email_change', 'signup', 'email'].includes(callback.type ?? '')) {
    const result = await client.auth.verifyOtp({ token_hash: callback.tokenHash, type: callback.type as EmailOtpType })
    if (result.error) throw result.error
    return { session: result.data.session, recovery: callback.mode === 'recovery' }
  }
  throw new Error('This email link is incomplete. Request a new link.')
}
