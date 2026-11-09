import type { Tables } from '../../shared/types/database'
import type { AccountIdentity } from '../account/types'

export type Group = Tables<'groups'>
export type GroupMember = Tables<'group_members'> & { profile: AccountIdentity }
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'
export type Invitation = Omit<Tables<'group_invitations'>, 'status'> & {
  status: InvitationStatus
  group_name?: string
}
