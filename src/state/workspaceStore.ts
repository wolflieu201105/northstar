import type { AppClient } from '../lib/supabase'
import type { LabelDraft } from '../types/label'
import type { TeamMemberDraft } from '../types/team'
import { archiveMember, createMember, fetchTeamMembers, updateMember } from '../services/team'
import { archiveLabel, createLabel, fetchLabels, updateLabel } from '../services/labels'
import { createResource } from './resource'

export function createWorkspaceStore(client: AppClient | null, userId: string | undefined) {
  const members = createResource(client && userId ? () => fetchTeamMembers(client, userId) : null)
  const labels = createResource(client && userId ? () => fetchLabels(client, userId) : null)
  const intents = new Map<string, string>()
  function context() {
    if (!client || !userId) throw new Error('Your guest session is not ready yet.')
    return { client, userId }
  }
  async function addMember(draft: TeamMemberDraft) {
    const connection = context()
    const key = `member:${JSON.stringify(draft)}`
    const id = intents.get(key) ?? crypto.randomUUID()
    intents.set(key, id)
    const row = await members.mutate(id, () => createMember(connection.client, connection.userId, draft, id))
    intents.delete(key)
    return row
  }
  async function addLabel(draft: LabelDraft) {
    const connection = context()
    const key = `label:${JSON.stringify(draft)}`
    const id = intents.get(key) ?? crypto.randomUUID()
    intents.set(key, id)
    const row = await labels.mutate(id, () => createLabel(connection.client, connection.userId, draft, id))
    intents.delete(key)
    return row
  }
  return {
    members, labels, addMember, addLabel,
    editMember(id: string, draft: TeamMemberDraft) {
      const c = context()
      return members.mutate(id, () => updateMember(c.client, c.userId, id, draft))
    },
    setMemberArchived(id: string, archived: boolean) {
      const c = context()
      return members.mutate(id, () => archiveMember(c.client, c.userId, id, archived))
    },
    editLabel(id: string, draft: LabelDraft) {
      const c = context()
      return labels.mutate(id, () => updateLabel(c.client, c.userId, id, draft))
    },
    setLabelArchived(id: string, archived: boolean) {
      const c = context()
      return labels.mutate(id, () => archiveLabel(c.client, c.userId, id, archived))
    },
  }
}
