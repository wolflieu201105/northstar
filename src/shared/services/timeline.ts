import type { TimelineCursor, TimelinePage } from '../types/timeline'

export const TIMELINE_PAGE_SIZE = 50
export function cursorFilter(cursor: TimelineCursor) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.createdAt)) {
    throw new Error('Invalid timeline cursor. Reload this task.')
  }
  return `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`
}
export function timelinePage<T extends { id: string; created_at: string }>(rows: T[]): TimelinePage<T> {
  const items = rows.slice(0, TIMELINE_PAGE_SIZE)
  const last = items.at(-1)
  return { items, nextCursor: rows.length > TIMELINE_PAGE_SIZE && last ? { createdAt: last.created_at, id: last.id } : null }
}
