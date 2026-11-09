import type { AppClient } from '../../../shared/lib/supabase'
import type { Label, LabelDraft } from '../types'
import { labelNameKey, normalizeLabelDraft } from '../utils'
import { isLabel } from '../validation'
import { ServiceError, serviceError, unresolvedMutation } from '../../../shared/services/errors'

export class LabelNameConflictError extends ServiceError {
  constructor(public readonly existingLabel: Label | null) {
    super(existingLabel?.archived_at
      ? 'This name belongs to an archived label. Restore it or choose another name.'
      : 'A label with this name already exists. Choose another name.', '23505')
    this.name = 'LabelNameConflictError'
  }
}
export async function fetchLabels(client: AppClient, groupId: string) {
  const { data, error } = await client.from('labels').select('*').eq('group_id', groupId).order('name').order('id')
  if (error) throw serviceError(error)
  return data ?? []
}
async function save(client: AppClient, groupId: string, id: string, input: { name?: string; color?: string; archived?: boolean }, token?: string) {
  const { data, error } = await client.rpc('save_label', {
    p_group_id: groupId, p_label_id: id,
    ...(input.name !== undefined ? { p_name: input.name } : {}),
    ...(input.color !== undefined ? { p_color: input.color } : {}),
    ...(input.archived !== undefined ? { p_archived: input.archived } : {}),
    ...(token !== undefined ? { p_expected_updated_at: token } : {}),
  })
  if (error) {
    const problem = serviceError(error)
    if (problem.uncertain || (!token && ['23505', '40001'].includes(problem.code))) {
      try {
        const rows = await fetchLabels(client, groupId)
        const row = rows.find((label) => label.id === id)
        if (row && (input.name === undefined || row.name === input.name)
          && (input.color === undefined || row.color === input.color)
          && (input.archived === undefined || Boolean(row.archived_at) === input.archived)) return row
      } catch { if (problem.uncertain) throw unresolvedMutation() }
      if (problem.uncertain) throw unresolvedMutation()
    }
    if (problem.code === '23505') {
      let existing: Label | null = null
      try { existing = (await fetchLabels(client, groupId)).find((row) => labelNameKey(row.name) === labelNameKey(input.name ?? '')) ?? null } catch { /* Show a safe name conflict. */ }
      throw new LabelNameConflictError(existing)
    }
    throw problem
  }
  if (!isLabel(data) || data.group_id !== groupId) throw new Error('Invalid label response. Refresh labels.')
  return data
}
export async function createLabel(client: AppClient, groupId: string, draft: LabelDraft, id: string = crypto.randomUUID()) {
  return save(client, groupId, id, normalizeLabelDraft(draft))
}
export async function updateLabel(client: AppClient, groupId: string, id: string, draft: LabelDraft, token: string) {
  return save(client, groupId, id, normalizeLabelDraft(draft), token)
}
export function archiveLabel(client: AppClient, groupId: string, id: string, archived: boolean, token: string) {
  return save(client, groupId, id, { archived }, token)
}
