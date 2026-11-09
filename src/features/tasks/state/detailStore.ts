import type { AppClient } from '../../../shared/lib/supabase'
import { fetchActivity, fetchRecentActivity } from '../../activity/services/activity'
import { createComment, fetchComments, fetchRecentComments } from '../../comments/services/comments'
import { serviceError } from '../../../shared/services/errors'
import { observable } from '../../../shared/state/observable'
import { createTimelineResource } from '../../../shared/state/timelineResource'
import { normalizeCommentBody } from '../../comments/utils'

export function createDetailStore(client: AppClient | null, userId: string | undefined, taskId: string | null, groupId?: string, onAccessError?: () => void) {
  const ready = Boolean(client && userId && groupId && taskId)
  const comments = createTimelineResource(
    ready ? (cursor) => fetchComments(client!, groupId!, taskId!, cursor) : null,
    ready ? () => fetchRecentComments(client!, groupId!, taskId!) : null, onAccessError)
  const activity = createTimelineResource(
    ready ? (cursor) => fetchActivity(client!, groupId!, taskId!, cursor) : null,
    ready ? () => fetchRecentActivity(client!, groupId!, taskId!) : null, onAccessError)
  const state = observable({ comments: comments.getSnapshot(), activity: activity.getSnapshot(), commentDraft: '', isPosting: false, commentSaveError: null as string | null })
  comments.subscribe(() => state.update({ comments: comments.getSnapshot() }))
  activity.subscribe(() => state.update({ activity: activity.getSnapshot() }))
  const intents = new Map<string, string>()
  let active = false
  let posting = false
  let lastRevision: string | undefined
  async function postComment() {
    if (!active || !client || !userId || !groupId || !taskId) throw new Error('Open a task in an accessible group first.')
    if (posting) return
    const draft = state.getSnapshot().commentDraft
    let body: string
    try { body = normalizeCommentBody(draft) }
    catch (error) { state.update({ commentSaveError: serviceError(error).message }); throw error }
    const id = intents.get(body) ?? crypto.randomUUID()
    intents.set(body, id)
    posting = true
    state.update({ isPosting: true, commentSaveError: null })
    try {
      const saved = await createComment(client, groupId, taskId, body, id, userId)
      if (!active) return saved
      intents.delete(body); comments.confirm(saved)
      state.update((current) => ({ ...current, commentDraft: current.commentDraft === draft ? '' : current.commentDraft }))
      return saved
    } catch (error) {
      if (active && serviceError(error).code === '42501') onAccessError?.()
      if (active) state.update({ commentSaveError: serviceError(error).message })
      throw error
    } finally { posting = false; if (active) state.update({ isPosting: false }) }
  }
  return {
    ...state, postComment,
    loadComments: comments.load, loadActivity: activity.load,
    retryComments: comments.retry, retryActivity: activity.retry,
    refresh: () => Promise.all([comments.refresh(), activity.refresh()]),
    setCommentDraft(commentDraft: string) { state.update({ commentDraft, commentSaveError: null }) },
    start() { active = true; comments.start(); activity.start() },
    stop() { active = false; comments.stop(); activity.stop() },
    invalidateActivity(revision: string | undefined) {
      if (revision === lastRevision) return
      const previous = lastRevision
      lastRevision = revision
      if (previous !== undefined) void activity.load(false, true)
    },
  }
}
