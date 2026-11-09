export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const isNullableText = (value: unknown) => value === null || typeof value === 'string'

export function isOwnedRow(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && ['id', 'user_id', 'created_at'].every((key) => typeof value[key] === 'string')
}
