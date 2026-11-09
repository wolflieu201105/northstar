import type { User } from '@supabase/supabase-js'

const KEY = 'northstar.pending-registration.v1'
export interface PendingRegistration { userId: string; email: string }
export function readRegistration(): PendingRegistration | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (value && typeof value === 'object' && 'userId' in value && 'email' in value && typeof value.userId === 'string' && typeof value.email === 'string') return { userId: value.userId, email: value.email }
  } catch { /* Storage may be unavailable; Auth's persisted identity remains authoritative. */ }
  return null
}
export function writeRegistration(value: PendingRegistration | null) {
  try { if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY) } catch { /* The current tab can still finish registration. */ }
}
export function emailVerified(user: User, pending: PendingRegistration) {
  return user.id === pending.userId && user.email?.toLowerCase() === pending.email.toLowerCase() && Boolean(user.email_confirmed_at)
}
export function validatePassword(password: string, confirmation: string) {
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.')
  if (password !== confirmation) throw new Error('The passwords do not match.')
}
