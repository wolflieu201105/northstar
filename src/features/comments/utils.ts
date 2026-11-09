import { COMMENT_MAX_LENGTH } from './types'

export function normalizeCommentBody(body: string) {
  const text = body.trim()
  if (!text || text.length > COMMENT_MAX_LENGTH) throw new Error('Comments must contain 1–2,000 characters.')
  return text
}
