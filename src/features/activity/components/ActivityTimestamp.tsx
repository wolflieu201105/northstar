import { relativeActivityTime } from '../formatting/relativeTime'

export function ActivityTimestamp({ value, now }: { value: string; now: number }) {
  if (!Number.isFinite(Date.parse(value))) return <span className="detail-hint">Time unavailable</span>
  const exact = new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
  const relative = relativeActivityTime(value, now)
  return <time dateTime={value} title={exact} aria-label={`${relative} · ${exact}`}>{relative}</time>
}
