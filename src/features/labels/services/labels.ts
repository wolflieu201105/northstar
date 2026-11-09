import type { AppClient } from '../../../shared/lib/supabase'
import type { Label, LabelDraft } from '../types'
import { labelNameKey, normalizeLabelDraft } from '../utils'
import { ServiceError, serviceError, unresolvedMutation } from '../../../shared/services/errors'

export class LabelNameConflictError extends ServiceError {
  constructor(public readonly existingLabel: Label | null) {
    super(existingLabel?.archived_at
      ? 'This name belongs to an archived label. Restore it or choose another name.'
      : 'A label with this name already exists. Choose another name.', '23505')
    this.name = 'LabelNameConflictError'
  }
}

async function nameConflict(client: AppClient, userId: string, name: string) {
  // Reuse the owned directory so punctuation in names is never treated as a filter pattern.
  try {
    const labels = await fetchLabels(client, userId)
    return new LabelNameConflictError(labels.find((label) => labelNameKey(label.name) === labelNameKey(name)) ?? null)
  } catch { return new LabelNameConflictError(null) }
}

export async function fetchLabels(client: AppClient, userId: string) {
  const { data, error } = await client.from('labels').select('*').eq('user_id', userId).order('name').order('id')
  if (error) throw serviceError(error)
  return data ?? []
}
export async function createLabel(client: AppClient, userId: string, draft: LabelDraft, id: string = crypto.randomUUID()) {
  const input = normalizeLabelDraft(draft)
  const { data, error } = await client.from('labels').insert({ ...input, id, user_id: userId }).select('*').single()
  if (!error) return data
  const problem = serviceError(error)
  if (problem.uncertain || problem.code === '23505') {
    const { data: saved, error: readError } = await client.from('labels').select('*').eq('user_id', userId).eq('id', id).maybeSingle()
    if (!readError && saved && saved.name === input.name && saved.color === input.color) return saved
    if (problem.uncertain) throw unresolvedMutation()
  }
  if (problem.code === '23505') throw await nameConflict(client, userId, input.name)
  throw problem
}
export async function updateLabel(client: AppClient, userId: string, id: string, draft: LabelDraft) {
  const input = normalizeLabelDraft(draft)
  const { data, error } = await client.from('labels').update(input).eq('user_id', userId).eq('id', id).select('*').maybeSingle()
  if (error) {
    const problem = serviceError(error)
    if (problem.code === '23505') throw await nameConflict(client, userId, input.name)
    throw problem
  }
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
