import type { TaskActivity } from '../types'
import { activityDescription } from '../formatActivity'
import { Timestamp } from '../../../shared/components/Timestamp'
import type { TimelineListState } from '../../../shared/types/timeline'

interface ActivityTimelineProps {
  activity: TimelineListState<TaskActivity>
  onRetry: () => void
  onLoadMore: () => void
}

export function ActivityTimeline({ activity, onRetry, onLoadMore }: ActivityTimelineProps) {
  return <>
    {activity.isLoading && <p className="detail-hint" role="status">Loading activity…</p>}
    {activity.error && <div className="form-error" role="alert"><p>{activity.error}</p>
      <button type="button" className="text-button" disabled={activity.isLoading} onClick={onRetry}>Retry activity</button></div>}
    {!activity.isLoading && !activity.error && activity.items.length === 0 && <p className="detail-hint">
      No activity recorded yet. History starts when activity capture is enabled.
    </p>}
    <ol className="activity-list" aria-label="Activity, oldest first">
      {activity.items.map((event) => <li key={event.id}>
        <p>{activityDescription(event)}</p><Timestamp value={event.created_at} />
      </li>)}
    </ol>
    {activity.nextCursor && <button type="button" className="button button-secondary" disabled={activity.isLoading} onClick={onLoadMore}>Load more activity</button>}
  </>
}
