import type { AppClient } from '../../shared/lib/supabase'
import type { LabelDraft } from '../labels/types'
import { fetchMembers } from '../groups/services/groups'
import { archiveLabel, createLabel, fetchLabels, updateLabel } from '../labels/services/labels'
import { serviceError } from '../../shared/services/errors'
import { createResource } from '../../shared/state/resource'

export function createWorkspaceStore(client: AppClient | null, userId: string | undefined, groupId?: string, onAccessError?: () => void) {
  async function request<T>(operation: () => Promise<T>) {
    try { return await operation() }
    catch (reason) { if (serviceError(reason).code === '42501') onAccessError?.(); throw reason }
  }
  const ready = client && userId && groupId
  const members = createResource(ready ? async () => (await request(() => fetchMembers(client, groupId))).filter((row) => row.is_active).map((row) => row.profile) : null)
  const labels = createResource(ready ? () => request(() => fetchLabels(client, groupId)) : null)
  const intents = new Map<string, string>()
  function context() {
    if (!client || !userId || !groupId) throw new Error('Select an accessible group first.')
    return { client, groupId }
  }
  function token(id: string) {
    const label = labels.getSnapshot().items.find((row) => row.id === id)
    if (!label) throw new Error('This label is no longer available. Refresh labels.')
    return label.updated_at
  }
  async function addLabel(draft: LabelDraft) {
    const c = context()
    const key = JSON.stringify(draft)
    const id = intents.get(key) ?? crypto.randomUUID()
    intents.set(key, id)
    const row = await labels.mutate(id, () => request(() => createLabel(c.client, c.groupId, draft, id)))
    intents.delete(key)
    return row
  }
  return {
    members, labels, addLabel,
    editLabel(id: string, draft: LabelDraft, expectedUpdatedAt?: string) {
      const c = context()
      return labels.mutate(id, () => request(() => updateLabel(c.client, c.groupId, id, draft, expectedUpdatedAt ?? token(id))))
    },
    setLabelArchived(id: string, archived: boolean, expectedUpdatedAt?: string) {
      const c = context()
      return labels.mutate(id, () => request(() => archiveLabel(c.client, c.groupId, id, archived, expectedUpdatedAt ?? token(id))))
    },
  }
}
