import type { AppClient } from '../../../shared/lib/supabase'
import type { TaskActivity } from '../../activity/types'
import type { TaskComment } from '../../comments/types'
import type { TimelineListState as ListState } from '../../../shared/types/timeline'
import { fetchActivity } from '../../activity/services/activity'
import { createComment, fetchComments } from '../../comments/services/comments'
import { serviceError } from '../../../shared/services/errors'
import { observable } from '../../../shared/state/observable'
import { normalizeCommentBody } from '../../comments/utils'
import { compareTimelineRows } from '../../../shared/lib/timelineOrder'

interface DetailState {
  comments: ListState<TaskComment> & { isLoadingMore: boolean; failedLoadMore: boolean }
  activity: ListState<TaskActivity>
  commentDraft: string
  isPosting: boolean
  commentSaveError: string | null
}
const emptyList = <Row>(isLoading = false): ListState<Row> => ({ items: [], nextCursor: null, isLoading, error: null })
function mergeRows<Row extends { id: string; created_at: string }>(old: Row[], incoming: Row[]) {
  return [...new Map([...old, ...incoming].map((row) => [row.id, row])).values()]
    .sort(compareTimelineRows)
}

export function createDetailStore(client: AppClient | null, userId: string | undefined, taskId: string | null) {
  const initiallyLoading = Boolean(client && userId && taskId)
  const state = observable<DetailState>({ comments: { ...emptyList<TaskComment>(initiallyLoading), isLoadingMore: false, failedLoadMore: false }, activity: emptyList(initiallyLoading), commentDraft: '', isPosting: false, commentSaveError: null })
  const requests = { comments: 0, activity: 0 }
  const commentIntents = new Map<string, string>()
  const confirmedComments = new Map<string, TaskComment>()
  let active = false
  let posting = false
  let lastTaskRevision: string | undefined
  async function loadComments(more = false) {
    if (!client || !userId || !taskId || !active) return
    const previous = state.getSnapshot().comments
    if (more && (previous.isLoading || !previous.nextCursor)) return
    const request = ++requests.comments
    state.update({ comments: { ...previous, isLoading: true, isLoadingMore: more, failedLoadMore: false, error: null } })
    try {
      const page = await fetchComments(client, userId, taskId, more ? previous.nextCursor! : undefined)
      if (active && request === requests.comments) state.update((current) => ({ ...current,
        comments: {
          items: mergeRows(more ? current.comments.items : [...confirmedComments.values()], page.items),
          nextCursor: page.nextCursor, isLoading: false, isLoadingMore: false, failedLoadMore: false, error: null,
        },
      }))
    } catch (error) {
      if (active && request === requests.comments) state.update((current) => ({ ...current,
        comments: { ...current.comments, isLoading: false, isLoadingMore: false, failedLoadMore: more, error: serviceError(error).message },
      }))
    }
  }
  async function loadActivity(more = false) {
    if (!client || !userId || !taskId || !active) return
    const previous = state.getSnapshot().activity
    if (more && (previous.isLoading || !previous.nextCursor)) return
    const request = ++requests.activity
    state.update({ activity: { ...previous, isLoading: true, error: null } })
    try {
      const page = await fetchActivity(client, userId, taskId, more ? previous.nextCursor! : undefined)
      if (active && request === requests.activity) state.update((current) => ({ ...current,
        activity: { items: mergeRows(more ? current.activity.items : [], page.items), nextCursor: page.nextCursor, isLoading: false, error: null },
      }))
    } catch (error) {
      if (active && request === requests.activity) state.update((current) => ({ ...current,
        activity: { ...current.activity, isLoading: false, error: serviceError(error).message },
      }))
    }
  }
  async function postComment() {
    if (!active || !client || !userId || !taskId) throw new Error('Open a task in your guest workspace first.')
    if (posting) return
    const draft = state.getSnapshot().commentDraft
    let body: string
    try { body = normalizeCommentBody(draft) }
    catch (error) { state.update({ commentSaveError: serviceError(error).message }); throw error }
    const id = commentIntents.get(body) ?? crypto.randomUUID()
    commentIntents.set(body, id)
    posting = true
    state.update({ isPosting: true, commentSaveError: null })
    try {
      const saved = await createComment(client, userId, taskId, body, id)
      commentIntents.delete(body)
      confirmedComments.set(saved.id, saved)
      state.update((current) => ({ ...current,
        commentDraft: current.commentDraft === draft ? '' : current.commentDraft,
        comments: { ...current.comments, items: mergeRows(current.comments.items, [saved]) },
      }))
      return saved
    } catch (error) {
      state.update({ commentSaveError: serviceError(error).message })
      throw error
    } finally { posting = false; state.update({ isPosting: false }) }
  }
  return {
    ...state, loadComments, loadActivity, postComment,
    retryComments() { return loadComments(state.getSnapshot().comments.failedLoadMore) },
    setCommentDraft(commentDraft: string) { state.update({ commentDraft, commentSaveError: null }) },
    start() { active = true; void loadComments(); void loadActivity() },
    stop() { active = false; ++requests.comments; ++requests.activity },
    invalidateActivity(revision: string | undefined) {
      if (revision === lastTaskRevision) return
      const hadRevision = lastTaskRevision !== undefined
      lastTaskRevision = revision
      if (hadRevision) void loadActivity()
    },
  }
}
