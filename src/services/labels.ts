import type { AppClient } from '../lib/supabase'
import type { LabelDraft } from '../types/label'
import { AVATAR_COLORS } from '../types/team'
import { serviceError, unresolvedMutation } from './errors'

export async function fetchLabels(client: AppClient, userId: string) {
  const { data, error } = await client.from('labels').select('*').eq('user_id', userId).order('name').order('id')
  if (error) throw serviceError(error)
  return data ?? []
}
function normalize(draft: LabelDraft) {
  const name = draft.name.trim()
  if (!name || name.length > 40) throw new Error('Label names must contain 1–40 characters.')
  if (!AVATAR_COLORS.includes(draft.color)) throw new Error('Choose an available label color.')
  return { name, color: draft.color }
}
export async function createLabel(client: AppClient, userId: string, draft: LabelDraft, id: string = crypto.randomUUID()) {
  const input = normalize(draft)
  const { data, error } = await client.from('labels').insert({ ...input, id, user_id: userId }).select('*').single()
  if (!error) return data
  const problem = serviceError(error)
  if (problem.uncertain || problem.code === '23505') {
    const { data: saved, error: readError } = await client.from('labels').select('*').eq('user_id', userId).eq('id', id).maybeSingle()
    if (!readError && saved && saved.name === input.name && saved.color === input.color) return saved
    if (problem.uncertain) throw unresolvedMutation()
  }
  if (problem.code === '23505') throw new Error('This label name already exists. Restore it if it is archived.')
  throw problem
}
export async function updateLabel(client: AppClient, userId: string, id: string, draft: LabelDraft) {
  const { data, error } = await client.from('labels').update(normalize(draft)).eq('user_id', userId).eq('id', id).select('*').maybeSingle()
  if (error) throw serviceError(error)
  if (!data) throw new Error('The label is no longer available.')
  return data
}
export async function archiveLabel(client: AppClient, userId: string, id: string, archived: boolean) {
  const { data, error } = await client.from('labels').update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('user_id', userId).eq('id', id).select('*').maybeSingle()
  if (error) throw serviceError(error)
  if (!data) throw new Error('The label is no longer available.')
  return data
}
