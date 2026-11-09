import type { TaskActivity } from '../types'
import { formatActivity } from '../formatting/formatActivity'
import { ActivityTimestamp } from './ActivityTimestamp'

export function ActivityRows({ items, now, recent = false }: { items: TaskActivity[]; now: number; recent?: boolean }) {
  if (!items.length) return null
  return <ol className="activity-list" aria-label={recent ? 'Recent activity, oldest first' : 'Activity, oldest first'}>
    {items.map((event) => {
      const presentation = formatActivity(event)
      return <li key={event.id}>
        <p>{presentation.summary}</p>
        {presentation.context && <p className="activity-context">{presentation.context}</p>}
        <div className="activity-meta"><span>{event.actor_name}</span><span aria-hidden="true">·</span><ActivityTimestamp value={event.created_at} now={now} /></div>
        {presentation.changes && presentation.changes.length > 0 && <details className="activity-details"><summary>View changes</summary>
          <dl>{presentation.changes.map((change) => <div key={change.field} className="activity-change">
            <dt>{change.label}</dt><dd><span>From</span><p>{change.from}</p></dd><dd><span>To</span><p>{change.to}</p></dd>
          </div>)}</dl>
        </details>}
      </li>
    })}
  </ol>
}
