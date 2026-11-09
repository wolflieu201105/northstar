import type { useTaskDetails } from '../../tasks/hooks/useTaskDetails'
import type { TaskComment } from '../types'
import { isAfterTimelineCursor } from '../../../shared/lib/timelineOrder'
import { Timestamp } from '../../../shared/components/Timestamp'

interface CommentListProps {
  comments: ReturnType<typeof useTaskDetails>['comments']
  onRetry: () => void
  onLoadMore: () => void
}

function CommentRows({ items, recent = false }: { items: TaskComment[]; recent?: boolean }) {
  if (!items.length) return null
  return <ol className="comment-list" aria-label={recent ? 'Your recent comments, oldest first' : 'Comments, oldest first'}>
    {items.map((comment) => <li key={comment.id}>
      <div className="comment-meta"><strong>You</strong><Timestamp value={comment.created_at} /></div>
      <p>{comment.body}</p>
    </li>)}
  </ol>
}

export function CommentList({ comments, onRetry, onLoadMore }: CommentListProps) {
  const { items, nextCursor, isLoading, isLoadingMore, failedLoadMore, error } = comments
  const older: TaskComment[] = []
  const recent: TaskComment[] = []
  for (const item of items) {
    if (nextCursor && isAfterTimelineCursor(item, nextCursor)) recent.push(item)
    else older.push(item)
  }
  const readError = error && <div className="form-error" role="alert"><p>{error}</p>
    <button type="button" className="text-button" disabled={isLoading} onClick={onRetry}>
      {failedLoadMore ? 'Retry loading more comments' : 'Retry comments'}</button></div>
  return <>
    {isLoading && !isLoadingMore && <p className="detail-hint" role="status">{items.length ? 'Refreshing comments…' : 'Loading comments…'}</p>}
    {!failedLoadMore && readError}
    {!isLoading && !error && items.length === 0 && <p className="detail-hint">No comments yet. Start the conversation below.</p>}
    <CommentRows items={older} />
    {nextCursor && <div className="comment-pagination">
      {recent.length > 0 && <p className="detail-hint">More comments appear before your recent update.</p>}
      {failedLoadMore && readError}
      {isLoadingMore && <p className="detail-hint" role="status">Loading more comments…</p>}
      <button type="button" className="button button-secondary" disabled={isLoading} onClick={onLoadMore}>
        {isLoadingMore ? 'Loading more…' : 'Load more comments'}</button>
    </div>}
    <CommentRows items={recent} recent />
  </>
}
