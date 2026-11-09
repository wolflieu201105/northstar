import type { TeamMember } from './types'
import { isOwnedRow, isNullableText } from '../../shared/lib/validation'

export function isMember(value: unknown): value is TeamMember {
  return isOwnedRow(value) && typeof value.name === 'string' && typeof value.updated_at === 'string'
    && isNullableText(value.avatar_color) && isNullableText(value.archived_at)
}
