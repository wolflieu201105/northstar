import { useId, useState } from 'react'
import type { useTaskDetails } from '../hooks/useTaskDetails'
import type { TaskActivity } from '../types/activity'
import { STATUS_META } from '../types/task'

type Details = ReturnType<typeof useTaskDetails>
const fieldNames: Record<string, string> = { title: 'title', description: 'description', priority: 'priority', due_date: 'due date' }
function activityDescription(event: TaskActivity) {
  switch (event.event_type) {
    case 'task_created': return `Created “${event.payload.title}”`
    case 'status_changed': return `Moved from ${STATUS_META[event.payload.from].label} → ${STATUS_META[event.payload.to].label}`
    case 'task_edited': return `Updated ${Object.keys(event.payload.changes).map((field) => fieldNames[field] ?? field).join(', ')}`
    case 'assignee_added': return `Assigned ${event.payload.member_name}`
    case 'assignee_removed': return `Unassigned ${event.payload.member_name}`
    case 'label_added': return `Added label “${event.payload.label_name}”`
    case 'label_removed': return `Removed label “${event.payload.label_name}”`
    default: return 'Task activity recorded'
  }
}

function Timestamp({ value }: { value: string }) {
  const exact = new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  return <time dateTime={value} title={exact}>{exact}</time>
}

export function TaskDiscussion({ details, disabled }: { details: Details; disabled: boolean }) {
  const [tab, setTab] = useState<'comments' | 'activity'>('comments')
  const id = useId()
  const list = tab === 'comments' ? details.comments : details.activity
  const load = (more: boolean) => tab === 'comments'
    ? more ? details.loadMoreComments() : details.reloadComments()
    : more ? details.loadMoreActivity() : details.reloadActivity()
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
      {list.isLoading && <p className="detail-hint" role="status">Loading {tab}…</p>}
      {list.error && <div className="form-error" role="alert"><p>{list.error}</p>
        <button type="button" className="text-button" disabled={list.isLoading} onClick={() => void load(false)}>Retry {tab}</button></div>}
      {!list.isLoading && !list.error && list.items.length === 0 && <p className="detail-hint">
        {tab === 'comments' ? 'No comments yet. Start the conversation below.' : 'No activity recorded yet. History starts when activity capture is enabled.'}
      </p>}
      {tab === 'comments' ? <ol className="comment-list" aria-label="Comments, oldest first">
        {details.comments.items.map((comment) => <li key={comment.id}>
          <div className="comment-meta"><strong>You</strong><Timestamp value={comment.created_at} /></div>
          <p>{comment.body}</p>
        </li>)}
      </ol> : <ol className="activity-list" aria-label="Activity, oldest first">
        {details.activity.items.map((event) => <li key={event.id}>
          <p>{activityDescription(event)}</p><Timestamp value={event.created_at} />
        </li>)}
      </ol>}
      {list.nextCursor && <button type="button" className="button button-secondary" disabled={list.isLoading}
        onClick={() => void load(true)}>Load more {tab}</button>}
      {tab === 'comments' && <form className="comment-composer" aria-label="Post a comment" onSubmit={(event) => {
        event.preventDefault()
        if (!disabled && !details.isPosting && details.commentDraft.trim()) void details.postComment().catch(() => { /* Error is retained by the detail store. */ })
      }}>
        <label className="form-field" htmlFor={`${id}-comment`}><span>Write a comment</span>
          <textarea id={`${id}-comment`} value={details.commentDraft} maxLength={2000} rows={3}
            onChange={(event) => details.setCommentDraft(event.target.value)} disabled={disabled || details.isPosting}
            placeholder="Add an update or leave a note…" /></label>
        {details.commentSaveError && <p className="form-error" role="alert">{details.commentSaveError}</p>}
        <div className="comment-composer-footer"><small>{details.commentDraft.length}/2000</small>
          <button className="button button-primary" type="submit" disabled={disabled || details.isPosting || !details.commentDraft.trim()}>
            {details.isPosting ? 'Posting…' : 'Post comment'}</button></div>
      </form>}
    </div>
  </section>
}
