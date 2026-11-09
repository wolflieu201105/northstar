import type { AppClient } from '../../../shared/lib/supabase'
import type { ProfileDraft } from '../types'
import { serviceError } from '../../../shared/services/errors'

export function validateProfile(draft: ProfileDraft) {
  const username = draft.username.trim().toLowerCase()
  const display_name = draft.display_name.trim()
  if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error('Username must be 3–30 characters using letters, numbers or underscores.')
  if (!display_name || display_name.length > 80) throw new Error('Display name must be 1–80 characters.')
  return { username, display_name, avatar_color: draft.avatar_color }
}

export async function fetchProfile(client: AppClient, userId: string) {
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).single()
  if (error) throw serviceError(error)
  return data
}
export async function saveProfile(client: AppClient, userId: string, draft: ProfileDraft) {
  const { data, error } = await client.from('profiles').update(validateProfile(draft)).eq('id', userId).select('*').single()
  if (error?.code === '23505') throw new Error('That username is already taken. Choose another.')
  if (error) throw serviceError(error)
  return data
}
