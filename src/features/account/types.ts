import type { Tables } from '../../shared/types/database'

export type Profile = Tables<'profiles'>
export type ProfileDraft = Pick<Profile, 'username' | 'display_name' | 'avatar_color'>
export type AccountIdentity = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_color'>
