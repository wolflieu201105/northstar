import type { TaskActivity } from '../types'
import { ActivityRows } from './ActivityRows'
import { isAfterTimelineCursor } from '../../../shared/lib/timelineOrder'
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
  const older = activity.items.filter((row) => !activity.nextCursor || !isAfterTimelineCursor(row, activity.nextCursor))
  const recent = activity.items.filter((row) => activity.nextCursor && isAfterTimelineCursor(row, activity.nextCursor))
  return <section className="activity-timeline" aria-label="Task activity" aria-busy={activity.isLoading}>
    <header className="activity-heading"><div><h3>Task history</h3><span>Oldest first</span></div>
      <button className="button button-secondary" type="button" onClick={onRefresh} disabled={activity.isLoading}>Refresh activity</button></header>
    {activity.isLoading && <p className="detail-hint" role="status">{activity.isLoadingMore ? 'Loading more activity…' : activity.items.length ? 'Refreshing activity…' : 'Loading activity…'}</p>}
    {activity.error && <div className="form-error" role="alert"><p>{activity.error}</p>
      <button type="button" className="text-button" disabled={activity.isLoading} onClick={onRetry}>{activity.failedLoadMore ? 'Retry loading more activity' : 'Retry activity'}</button></div>}
    {!activity.isLoading && !activity.error && activity.items.length === 0 && <p className="detail-hint">
      No activity yet. Changes made before history was enabled are unavailable.
    </p>}
    <ActivityRows items={older} now={now} />
    {activity.nextCursor && !activity.error && <div className="activity-pagination">
      <p className="detail-hint">{recent.length ? 'More history appears before these recent changes.' : 'More history follows. Newest changes appear at the end.'}</p>
      <button type="button" className="button button-secondary" disabled={activity.isLoading} onClick={onLoadMore}>{activity.isLoadingMore ? 'Loading more…' : 'Load more activity'}</button>
    </div>}
    <ActivityRows items={recent} now={now} recent />
  </section>
}
