import type { Tables } from './database'

export type TaskComment = Tables<'comments'>
export interface TimelineCursor {
  createdAt: string
  id: string
}
export interface TimelinePage<T> {
  items: T[]
  nextCursor: TimelineCursor | null
}
