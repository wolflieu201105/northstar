import type { Tables } from '../../shared/types/database'

export type TaskComment = Tables<'comments'>
export const COMMENT_MAX_LENGTH = 2000
