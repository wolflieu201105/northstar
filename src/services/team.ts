import type { AppClient } from '../lib/supabase'
import type { TeamMember, TeamMemberDraft } from '../types/team'
import { normalizeMemberDraft } from '../lib/teamUtils'
import { serviceError, unresolvedMutation } from './errors'

export async function fetchTeamMembers(client: AppClient, userId: string) {
  const { data, error } = await client.from('team_members').select('*').eq('user_id', userId).order('name').order('id')
  if (error) throw serviceError(error)
  return data ?? []
}
export async function createMember(client: AppClient, userId: string, draft: TeamMemberDraft, id: string = crypto.randomUUID()): Promise<TeamMember> {
  const input = normalizeMemberDraft(draft)
  const { data, error } = await client.from('team_members').insert({ ...input, id, user_id: userId }).select('*').single()
  if (!error) return data
  const problem = serviceError(error)
  if (problem.uncertain || problem.code === '23505') {
    const { data: saved, error: readError } = await client.from('team_members').select('*').eq('user_id', userId).eq('id', id).maybeSingle()
    if (!readError && saved && saved.name === input.name && saved.avatar_color === input.avatar_color) return saved
    if (problem.uncertain) throw unresolvedMutation()
  }
  throw problem
}
export async function updateMember(client: AppClient, userId: string, id: string, draft: TeamMemberDraft) {
  const { data, error } = await client.from('team_members').update(normalizeMemberDraft(draft)).eq('user_id', userId).eq('id', id).select('*').maybeSingle()
  if (error) throw serviceError(error)
  if (!data) throw new Error('The team member is no longer available.')
  return data
}
export async function archiveMember(client: AppClient, userId: string, id: string, archived: boolean) {
  const { data, error } = await client.from('team_members').update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('user_id', userId).eq('id', id).select('*').maybeSingle()
  if (error) throw serviceError(error)
  if (!data) throw new Error('The team member is no longer available.')
  return data
}
