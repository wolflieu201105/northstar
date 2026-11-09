import type { TeamMember } from './types'
import { isRecord, isNullableText } from '../../shared/lib/validation'

export function isMember(value: unknown): value is TeamMember {
  return isRecord(value) && ['id', 'username', 'display_name'].every((key) => typeof value[key] === 'string')
    && isNullableText(value.avatar_color)
}
