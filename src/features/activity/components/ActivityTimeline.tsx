import type { TaskActivity } from '../types'
import { formatActivity } from '../formatting/formatActivity'
import { ActivityTimestamp } from './ActivityTimestamp'
import { useActivityClock } from '../hooks/useActivityClock'
import type { PaginatedTimelineState } from '../../../shared/types/timeline'

interface ActivityTimelineProps {
  activity: PaginatedTimelineState<TaskActivity>
  onRetry: () => void
  onLoadMore: () => void
  onRefresh: () => void
}

export function ActivityTimeline({ activity, onRetry, onLoadMore, onRefresh }: ActivityTimelineProps) {
  const now = useActivityClock()
  return <section className="activity-timeline" aria-label="Task activity" aria-busy={activity.isLoading}>
    <header className="activity-heading"><div><h3>Task history</h3><span>Oldest first</span></div>
      <button className="button button-secondary" type="button" onClick={onRefresh} disabled={activity.isLoading}>Refresh activity</button></header>
    {activity.isLoading && <p className="detail-hint" role="status">{activity.isLoadingMore ? 'Loading more activity…' : activity.items.length ? 'Refreshing activity…' : 'Loading activity…'}</p>}
    {activity.error && <div className="form-error" role="alert"><p>{activity.error}</p>
      <button type="button" className="text-button" disabled={activity.isLoading} onClick={onRetry}>{activity.failedLoadMore ? 'Retry loading more activity' : 'Retry activity'}</button></div>}
    {!activity.isLoading && !activity.error && activity.items.length === 0 && <p className="detail-hint">
      No activity yet. Changes made before history was enabled are unavailable.
    </p>}
    <ol className="activity-list" aria-label="Activity, oldest first">
      {activity.items.map((event) => {
        const presentation = formatActivity(event)
        return <li key={event.id}>
          <p>{presentation.summary}</p>
          {presentation.context && <p className="activity-context">{presentation.context}</p>}
          <div className="activity-meta"><span>{event.actor_user_id === event.user_id ? 'You' : 'Guest'}</span><span aria-hidden="true">·</span><ActivityTimestamp value={event.created_at} now={now} /></div>
          {presentation.changes && presentation.changes.length > 0 && <details className="activity-details"><summary>View changes</summary>
            <dl>{presentation.changes.map((change) => <div key={change.field} className="activity-change">
              <dt>{change.label}</dt>
              <dd><span>From</span><p>{change.from}</p></dd>
              <dd><span>To</span><p>{change.to}</p></dd>
            </div>)}</dl>
          </details>}
        </li>
      })}
    </ol>
    {activity.nextCursor && !activity.error && <div className="activity-pagination">
      <p className="detail-hint">More history follows. Newest changes appear at the end.</p>
      <button type="button" className="button button-secondary" disabled={activity.isLoading} onClick={onLoadMore}>{activity.isLoadingMore ? 'Loading more…' : 'Load more activity'}</button>
    </div>}
  </section>
}
