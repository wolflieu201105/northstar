import type { AppClient } from '../../../shared/lib/supabase'
import type { Group, GroupMember, Invitation, InvitationStatus } from '../types'
import type { AccountIdentity } from '../../account/types'
import type { TimelineCursor } from '../../../shared/types/timeline'
import { isRecord } from '../../../shared/lib/validation'
import { serviceError } from '../../../shared/services/errors'

function groupResult(value: unknown): Group {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.owner_user_id !== 'string') throw new Error('Invalid group response. Refresh your groups.')
  return value as Group
}
export function invitationResult(value: unknown): Invitation {
  const statuses: InvitationStatus[] = ['pending', 'accepted', 'declined', 'revoked', 'expired']
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.group_id !== 'string' || typeof value.recipient_user_id !== 'string' || !statuses.includes(value.status as InvitationStatus) || typeof value.created_at !== 'string') throw new Error('Invalid invitation response. Refresh your invitations.')
  return value as Invitation
}
export async function fetchGroups(client: AppClient): Promise<Group[]> {
  const { data, error } = await client.from('groups').select('*').order('created_at').order('id')
  if (error) throw serviceError(error)
  return (data ?? []).map(groupResult)
}
export async function fetchMembers(client: AppClient, groupId: string): Promise<GroupMember[]> {
  const { data, error } = await client.from('group_members')
    .select('*,profile:profiles!group_members_user_id_fkey(id,username,display_name,avatar_color)')
    .eq('group_id', groupId).order('joined_at').order('user_id')
  if (error) throw serviceError(error)
  return (data ?? []).map((row) => {
    if (!row.profile) throw new Error('A member profile could not be loaded.')
    return { ...row, profile: row.profile }
  })
}
export async function createGroup(client: AppClient, name: string, id: string) {
  const p_name = name.trim()
  if (!p_name || p_name.length > 80) throw new Error('Group name must be 1–80 characters.')
  const { data, error } = await client.rpc('create_group', { p_name, p_group_id: id })
  if (error) throw serviceError(error)
  return groupResult(data)
}
export async function renameGroup(client: AppClient, groupId: string, name: string) {
  if (!name.trim() || name.trim().length > 80) throw new Error('Group name must be 1–80 characters.')
  const { data, error } = await client.rpc('rename_group', { p_group_id: groupId, p_name: name.trim() })
  if (error) throw serviceError(error)
  return groupResult(data)
}
export async function leaveGroup(client: AppClient, groupId: string) {
  const { error } = await client.rpc('leave_group', { p_group_id: groupId })
  if (error) throw serviceError(error)
}
export async function removeMember(client: AppClient, groupId: string, userId: string) {
  const { error } = await client.rpc('remove_group_member', { p_group_id: groupId, p_user_id: userId })
  if (error) throw serviceError(error)
}
export async function transferOwnership(client: AppClient, groupId: string, userId: string) {
  const { data, error } = await client.rpc('transfer_group_ownership', { p_group_id: groupId, p_user_id: userId })
  if (error) throw serviceError(error)
  return groupResult(data)
}
export async function deleteGroup(client: AppClient, groupId: string) {
  const { error } = await client.rpc('delete_group', { p_group_id: groupId })
  if (error) throw serviceError(error)
}
export async function lookupTarget(client: AppClient, groupId: string, query: string): Promise<AccountIdentity | null> {
  const { data, error } = await client.rpc('lookup_invitation_target', { p_group_id: groupId, p_query: query.trim() })
  if (error) throw serviceError(error)
  if (data === null) return null
  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.username !== 'string' || typeof data.display_name !== 'string') throw new Error('Invalid account response.')
  return data as AccountIdentity
}
export async function sendInvitation(client: AppClient, groupId: string, recipientId: string, id: string) {
  const { data, error } = await client.rpc('send_group_invitation', { p_group_id: groupId, p_recipient_user_id: recipientId, p_invitation_id: id })
  if (error) throw serviceError(error)
  return invitationResult(data)
}
export async function respondInvitation(client: AppClient, id: string, accept: boolean) {
  const { data, error } = await client.rpc('respond_group_invitation', { p_invitation_id: id, p_accept: accept })
  if (error) throw serviceError(error)
  return invitationResult(data)
}
export async function revokeInvitation(client: AppClient, id: string) {
  const { data, error } = await client.rpc('revoke_group_invitation', { p_invitation_id: id })
  if (error) throw serviceError(error)
  return invitationResult(data)
}
export async function fetchInvitations(client: AppClient, cursor?: TimelineCursor) {
  const { data, error } = await client.rpc('list_group_invitations', {
    p_limit: 50, ...(cursor ? { p_before_time: cursor.createdAt, p_before_id: cursor.id } : {}),
  })
  if (error) throw serviceError(error)
  if (!Array.isArray(data)) throw new Error('Invalid invitation list.')
  const items = data.map(invitationResult)
  const last = items.at(-1)
  return { items, nextCursor: items.length === 50 && last ? { createdAt: last.created_at, id: last.id } : null }
}
