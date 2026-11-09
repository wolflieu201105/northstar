import type { Label } from './types'
import { isGroupRow, isNullableText } from '../../shared/lib/validation'

export function isLabel(value: unknown): value is Label {
  return isGroupRow(value) && typeof value.name === 'string' && typeof value.updated_at === 'string'
    && typeof value.color === 'string' && isNullableText(value.archived_at)
}
