import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../lib/supabase'
import type { TaskComment } from '../types/comment'
import { createComment, fetchComments } from '../services/comments'
import { fetchActivity } from '../services/activity'
import { useTaskDetails } from './useTaskDetails'

vi.mock('../services/comments', () => ({ createComment: vi.fn(), fetchComments: vi.fn() }))
vi.mock('../services/activity', () => ({ fetchActivity: vi.fn() }))
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
