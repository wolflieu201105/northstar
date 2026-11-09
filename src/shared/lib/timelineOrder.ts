import type { TimelineCursor } from '../types/timeline'

function microseconds(time: string) {
  const fraction = time.match(/\.(\d+)/)?.[1] ?? ''
  return Date.parse(time) * 1000 + Number(fraction.padEnd(6, '0').slice(3, 6))
}

export function compareTimelineRows(left: { id: string; created_at: string }, right: { id: string; created_at: string }) {
  return microseconds(left.created_at) - microseconds(right.created_at)
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
}

export function isAfterTimelineCursor(row: { id: string; created_at: string }, cursor: TimelineCursor) {
  return compareTimelineRows(row, { id: cursor.id, created_at: cursor.createdAt }) > 0
}
