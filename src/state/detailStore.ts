import type { AppClient } from '../lib/supabase'
import type { TaskActivity } from '../types/activity'
import type { TaskComment, TimelineCursor } from '../types/comment'
import { fetchActivity } from '../services/activity'
import { createComment, fetchComments } from '../services/comments'
import { serviceError } from '../services/errors'
import { observable } from './observable'

interface ListState<Row> {
  items: Row[]
  nextCursor: TimelineCursor | null
  isLoading: boolean
  error: string | null
}
interface DetailState {
  comments: ListState<TaskComment>
  activity: ListState<TaskActivity>
  commentDraft: string
  isPosting: boolean
  commentSaveError: string | null
}
const emptyList = <Row>(): ListState<Row> => ({ items: [], nextCursor: null, isLoading: false, error: null })
function microseconds(time: string) {
  const fraction = time.match(/\.(\d+)/)?.[1] ?? ''
  return Date.parse(time) * 1000 + Number(fraction.padEnd(6, '0').slice(3, 6))
}
function mergeRows<Row extends { id: string; created_at: string }>(old: Row[], incoming: Row[]) {
  return [...new Map([...old, ...incoming].map((row) => [row.id, row])).values()]
    .sort((a, b) => microseconds(a.created_at) - microseconds(b.created_at) || a.id.localeCompare(b.id))
}

export function createDetailStore(client: AppClient | null, userId: string | undefined, taskId: string | null) {
  const state = observable<DetailState>({ comments: emptyList(), activity: emptyList(), commentDraft: '', isPosting: false, commentSaveError: null })
  const requests = { comments: 0, activity: 0 }
  const commentIntents = new Map<string, string>()
  let active = false
  let posting = false
  let lastTaskRevision: string | undefined
  async function loadComments(more = false) {
    if (!client || !userId || !taskId || !active) return
    const previous = state.getSnapshot().comments
    if (more && (previous.isLoading || !previous.nextCursor)) return
    const request = ++requests.comments
    state.update({ comments: { ...previous, isLoading: true, error: null } })
    try {
      const page = await fetchComments(client, userId, taskId, more ? previous.nextCursor! : undefined)
      if (active && request === requests.comments) state.update((current) => ({ ...current,
        comments: { items: mergeRows(current.comments.items, page.items), nextCursor: page.nextCursor, isLoading: false, error: null },
      }))
    } catch (error) {
      if (active && request === requests.comments) state.update((current) => ({ ...current,
        comments: { ...current.comments, isLoading: false, error: serviceError(error).message },
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
    if (!client || !userId || !taskId) throw new Error('Open a task in your guest workspace first.')
    if (posting) return
    const draft = state.getSnapshot().commentDraft
    const body = draft.trim()
    const id = commentIntents.get(body) ?? crypto.randomUUID()
    commentIntents.set(body, id)
    posting = true
    state.update({ isPosting: true, commentSaveError: null })
    try {
      const saved = await createComment(client, userId, taskId, body, id)
      commentIntents.delete(body)
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
    setCommentDraft(commentDraft: string) { state.update({ commentDraft }) },
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
