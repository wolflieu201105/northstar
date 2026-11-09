import { useId, useState } from 'react'
import type { useTaskDetails } from '../hooks/useTaskDetails'
import { CommentList } from '../../comments/components/CommentList'
import { CommentComposer } from '../../comments/components/CommentComposer'
import { ActivityTimeline } from '../../activity/components/ActivityTimeline'

type Details = ReturnType<typeof useTaskDetails>
export function TaskDiscussion({ details, disabled }: { details: Details; disabled: boolean }) {
  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const id = useId()
  const selectTab = (next: typeof tab) => {
    setTab(next)
    document.getElementById(`${id}-${next}`)?.focus()
  }
  return <section className="task-discussion" aria-label="Task discussion and history">
    <div className="detail-tabs" role="tablist" aria-label="Task discussion">
      {(['comments', 'activity'] as const).map((value) => <button key={value} type="button" role="tab"
        id={`${id}-${value}`} aria-selected={tab === value} aria-controls={`${id}-panel`} tabIndex={tab === value ? 0 : -1}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            selectTab(event.key === 'Home' ? 'comments' : event.key === 'End' ? 'activity' : tab === 'comments' ? 'activity' : 'comments')
          }
        }} onClick={() => setTab(value)}>{value === 'comments' ? 'Comments' : 'Activity'}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0} className="discussion-content">
      {tab === 'comments' ? <>
        <CommentList comments={details.comments} onRetry={() => void details.retryComments()} onLoadMore={() => void details.loadMoreComments()} />
        <CommentComposer draft={details.commentDraft} isPosting={details.isPosting} error={details.commentSaveError} disabled={disabled}
          onChange={details.setCommentDraft} onPost={details.postComment} />
      </> : <ActivityTimeline activity={details.activity} onRetry={() => void details.retryActivity()}
        onRefresh={() => void details.reloadActivity()} onLoadMore={() => void details.loadMoreActivity()} />}
    </div>
  </section>
}
