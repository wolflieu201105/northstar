import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import type { TaskComment } from '../../comments/types'
import { createComment, fetchComments } from '../../comments/services/comments'
import { fetchActivity } from '../../activity/services/activity'
import { useTaskDetails } from './useTaskDetails'
import { makeComment } from '../../../test/fixtures'

vi.mock('../../comments/services/comments', () => ({ createComment: vi.fn(), fetchComments: vi.fn() }))
vi.mock('../../activity/services/activity', () => ({ fetchActivity: vi.fn() }))
const client = {} as AppClient
const comment: TaskComment = { id: 'comment-1', user_id: 'user-1', task_id: 'task-1', body: 'Draft', created_at: '2026-11-08T14:00:00.000Z' }

describe('useTaskDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(fetchComments).mockResolvedValue({ items: [], nextCursor: null })
    vi.mocked(fetchActivity).mockResolvedValue({ items: [], nextCursor: null })
  })
  it('retains a failed comment draft and reuses its ID on retry', async () => {
    vi.mocked(createComment).mockRejectedValueOnce(new Error('Save failed')).mockResolvedValueOnce(comment)
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1'))
    await waitFor(() => expect(result.current.comments.isLoading).toBe(false))
    act(() => result.current.setCommentDraft('Draft'))
    await act(async () => { await expect(result.current.postComment()).rejects.toThrow('Save failed') })
    expect(result.current.commentDraft).toBe('Draft')
    await act(async () => { await result.current.postComment() })
    expect(createComment).toHaveBeenNthCalledWith(2, client, 'user-1', 'task-1', 'Draft', vi.mocked(createComment).mock.calls[0][4])
    expect(result.current.commentDraft).toBe('')
    expect(result.current.comments.items).toEqual([comment])
  })

  it('retries the failed page cursor and deduplicates rows in microsecond/ID order', async () => {
    const first = makeComment({ id: '00000000-0000-4000-8000-000000000002', created_at: '2026-11-09T05:00:00.000001Z' })
    const second = makeComment({ id: '00000000-0000-4000-8000-000000000001', created_at: '2026-11-09T05:00:00.000002Z' })
    const third = makeComment({ id: '00000000-0000-4000-8000-000000000003', created_at: second.created_at })
    const cursor = { id: first.id, createdAt: first.created_at }
    vi.mocked(fetchComments).mockResolvedValueOnce({ items: [first], nextCursor: cursor })
      .mockRejectedValueOnce(new Error('Page failed'))
      .mockResolvedValueOnce({ items: [third, first, second], nextCursor: null })
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1'))
    await waitFor(() => expect(result.current.comments.isLoading).toBe(false))
    await act(async () => { await result.current.loadMoreComments() })
    expect(result.current.comments.items).toEqual([first])
    expect(result.current.comments.failedLoadMore).toBe(true)
    await act(async () => { await result.current.retryComments() })
    expect(fetchComments).toHaveBeenNthCalledWith(3, client, 'user-1', 'task-1', cursor)
    expect(result.current.comments.items).toEqual([first, second, third])
    expect(result.current.comments.error).toBeNull()
    expect(result.current.comments.nextCursor).toBeNull()
  })

  it('keeps confirmed posts during reload and ignores an older page response', async () => {
    const first = makeComment()
    const later = makeComment({ id: 'later', created_at: '2026-11-09T05:00:00.000002Z' })
    const posted = makeComment({ id: 'posted', body: 'Local post', created_at: '2026-11-09T05:00:00.000003Z' })
    const cursor = { id: first.id, createdAt: first.created_at }
    let finishPage!: (page: { items: TaskComment[]; nextCursor: null }) => void
    vi.mocked(fetchComments).mockResolvedValueOnce({ items: [first], nextCursor: cursor })
      .mockImplementationOnce(() => new Promise((resolve) => { finishPage = resolve }))
      .mockResolvedValueOnce({ items: [first], nextCursor: cursor })
    vi.mocked(createComment).mockResolvedValue(posted)
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1'))
    await waitFor(() => expect(result.current.comments.isLoading).toBe(false))
    let pendingPage!: Promise<void>
    act(() => { pendingPage = result.current.loadMoreComments(); void result.current.loadMoreComments() })
    act(() => result.current.setCommentDraft('Local post'))
    await act(async () => { await result.current.postComment(); await result.current.reloadComments() })
    await act(async () => { finishPage({ items: [later], nextCursor: null }); await pendingPage })
    expect(fetchComments).toHaveBeenCalledTimes(3)
    expect(result.current.comments.items).toEqual([first, posted])
    expect(result.current.comments.nextCursor).toEqual(cursor)
  })

  it('blocks duplicate posting and preserves a newer draft when an earlier save finishes', async () => {
    let finish!: (row: TaskComment) => void
    vi.mocked(createComment).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1'))
    act(() => result.current.setCommentDraft('Draft'))
    let pending!: ReturnType<typeof result.current.postComment>
    act(() => { pending = result.current.postComment(); void result.current.postComment() })
    expect(createComment).toHaveBeenCalledOnce()
    act(() => result.current.setCommentDraft('A newer draft'))
    await act(async () => { finish(comment); await pending })
    expect(result.current.commentDraft).toBe('A newer draft')
    expect(result.current.comments.items).toEqual([comment])
    expect(result.current.isPosting).toBe(false)
  })

  it.each([{ name: 'blank', body: ' \n ' }, { name: 'too long', body: 'a'.repeat(2001) }])('rejects a $name comment before calling the service', async ({ body }) => {
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1'))
    act(() => result.current.setCommentDraft(body))
    await act(async () => { await expect(result.current.postComment()).rejects.toThrow('1–2,000 characters') })
    expect(createComment).not.toHaveBeenCalled()
    expect(result.current.commentDraft).toBe(body)
    expect(result.current.isPosting).toBe(false)
    expect(result.current.commentSaveError).toContain('1–2,000 characters')
  })

  it('isolates drafts and delayed read/post responses after the guest changes', async () => {
    let finishRead!: (page: { items: TaskComment[]; nextCursor: null }) => void
    let finishPost!: (row: TaskComment) => void
    const nextGuestComment = makeComment({ id: 'guest-B-comment', user_id: 'guest-B', body: 'B comment' })
    vi.mocked(fetchComments).mockImplementation(async (_client, owner) => owner === 'guest-A'
      ? new Promise((resolve) => { finishRead = resolve }) : { items: [nextGuestComment], nextCursor: null })
    vi.mocked(createComment).mockReturnValue(new Promise((resolve) => { finishPost = resolve }))
    const { result, rerender } = renderHook(({ owner }) => useTaskDetails(client, owner, 'task-1'), { initialProps: { owner: 'guest-A' } })
    act(() => result.current.setCommentDraft('A draft'))
    let pending!: ReturnType<typeof result.current.postComment>
    act(() => { pending = result.current.postComment() })
    rerender({ owner: 'guest-B' })
    await waitFor(() => expect(result.current.comments.items).toEqual([nextGuestComment]))
    act(() => result.current.setCommentDraft('B draft'))
    await act(async () => { finishRead({ items: [comment], nextCursor: null }); finishPost(comment); await pending })
    expect(result.current.commentDraft).toBe('B draft')
    expect(result.current.comments.items).toEqual([nextGuestComment])
    expect(result.current.isPosting).toBe(false)
  })
  it('keeps activity errors independent from usable comments', async () => {
    vi.mocked(fetchComments).mockResolvedValue({ items: [comment], nextCursor: null })
    vi.mocked(fetchActivity).mockRejectedValue(new Error('History unavailable'))
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1', 'revision-1'))
    await waitFor(() => expect(result.current.activity.error).toBe('History unavailable'))
    expect(result.current.comments.items).toEqual([comment])
    expect(result.current.comments.error).toBeNull()
  })

  it('does not erase a posted comment when an older initial read finishes', async () => {
    let finish!: (page: { items: TaskComment[]; nextCursor: null }) => void
    vi.mocked(fetchComments).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    vi.mocked(createComment).mockResolvedValue(comment)
    const { result } = renderHook(() => useTaskDetails(client, 'user-1', 'task-1'))
    act(() => result.current.setCommentDraft('Draft'))
    await act(async () => { await result.current.postComment() })
    await act(async () => { finish({ items: [], nextCursor: null }) })
    expect(result.current.comments.items).toEqual([comment])
  })
  it('ignores a previous task response and refreshes server history after a task change', async () => {
    let finish!: (page: { items: TaskComment[]; nextCursor: null }) => void
    vi.mocked(fetchComments).mockImplementation(async (_client, _owner, taskId) => taskId === 'task-1'
      ? new Promise((resolve) => { finish = resolve }) : { items: [], nextCursor: null })
    const { result, rerender } = renderHook(({ id, revision }) => useTaskDetails(client, 'user-1', id, revision), {
      initialProps: { id: 'task-1', revision: 'revision-1' },
    })
    rerender({ id: 'task-2', revision: 'revision-1' })
    await waitFor(() => expect(result.current.comments.isLoading).toBe(false))
    await act(async () => { finish({ items: [comment], nextCursor: null }) })
    expect(result.current.comments.items).toEqual([])
    const calls = vi.mocked(fetchActivity).mock.calls.length
    rerender({ id: 'task-2', revision: 'revision-2' })
    await waitFor(() => expect(fetchActivity).toHaveBeenCalledTimes(calls + 1))
  })
})
