import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import { fetchComments, createComment } from '../../comments/services/comments'
import { fetchActivity } from '../../activity/services/activity'
import { useTaskDetails } from '../hooks/useTaskDetails'
import { makeComment } from '../../../test/fixtures'
import { TaskDiscussion } from './TaskDiscussion'

vi.mock('../../comments/services/comments', () => ({ fetchComments: vi.fn(), createComment: vi.fn() }))
vi.mock('../../activity/services/activity', () => ({ fetchActivity: vi.fn() }))
const client = {} as AppClient
const older = makeComment({ body: 'Earlier update' })
const middle = makeComment({ id: '00000000-0000-4000-8000-000000000002', body: 'Middle update', created_at: '2026-11-09T05:00:00.000002Z' })
const latest = makeComment({ id: '00000000-0000-4000-8000-000000000003', body: 'Latest update', created_at: '2026-11-09T05:00:00.000003Z' })
const cursor = { id: older.id, createdAt: older.created_at }
function Harness() {
  const details = useTaskDetails(client, 'user-1', 'task-1')
  return <TaskDiscussion details={details} disabled={false} />
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(fetchComments).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(fetchActivity).mockResolvedValue({ items: [], nextCursor: null })
  vi.mocked(createComment).mockResolvedValue(latest)
})

describe('Task comments', () => {
  it('separates loading/empty states and renders safe plain text with exact timestamps', async () => {
    let finish!: (page: { items: ReturnType<typeof makeComment>[]; nextCursor: null }) => void
    vi.mocked(fetchComments).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const { container } = render(<Harness />)
    expect(screen.getByText('Loading comments…')).toBeVisible()
    expect(screen.queryByText('No comments yet. Start the conversation below.')).not.toBeInTheDocument()
    const body = '<img src=x onerror=alert(1)>\nSecond line stays.'
    await act(async () => { finish({ items: [makeComment({ body })], nextCursor: null }) })
    const list = screen.getByRole('list', { name: 'Comments, oldest first' })
    expect(within(list).getByText('You')).toBeVisible()
    expect(list.querySelector('p')?.textContent).toBe(body)
    expect(container.querySelector('img')).toBeNull()
    const time = list.querySelector('time')
    expect(time).toHaveAttribute('datetime', older.created_at)
    expect(time?.getAttribute('title')).toBe(time?.textContent)
  })

  it('posts during a read failure and retains the saved row when initial loading is retried', async () => {
    vi.mocked(fetchComments).mockRejectedValueOnce(new Error('Comments unavailable'))
      .mockResolvedValueOnce({ items: [older, latest], nextCursor: null })
    render(<Harness />)
    expect(await screen.findByText('Comments unavailable')).toBeVisible()
    expect(screen.queryByText('No comments yet. Start the conversation below.')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'Latest update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(await screen.findByText('Comment posted.')).toBeVisible()
    expect(screen.getByLabelText('Write a comment')).toHaveValue('')
    expect(screen.getByLabelText('Write a comment')).toHaveFocus()
    fireEvent.click(screen.getByRole('button', { name: 'Retry comments' }))
    await screen.findByText('Earlier update')
    expect(screen.getAllByText('Latest update')).toHaveLength(1)
    expect(screen.queryByText('Comments unavailable')).not.toBeInTheDocument()
  })

  it('places pagination before recent posts and retries the same failed cursor without duplicates', async () => {
    vi.mocked(fetchComments).mockResolvedValueOnce({ items: [older], nextCursor: cursor })
      .mockRejectedValueOnce(new Error('Next page unavailable'))
      .mockResolvedValueOnce({ items: [older, middle, latest], nextCursor: null })
    render(<Harness />)
    await screen.findByText('Earlier update')
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'Latest update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    await screen.findByText('Comment posted.')
    expect(screen.getByText('More comments appear before your recent update.')).toBeVisible()
    const load = screen.getByRole('button', { name: 'Load more comments' })
    expect(Boolean(load.compareDocumentPosition(screen.getByText('Latest update')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    fireEvent.click(load)
    expect(await screen.findByText('Next page unavailable')).toBeVisible()
    expect(screen.getByText('Earlier update')).toBeVisible()
    expect(screen.getByText('Latest update')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading more comments' }))
    await screen.findByText('Middle update')
    expect(fetchComments).toHaveBeenNthCalledWith(3, client, 'user-1', 'task-1', cursor)
    const list = screen.getByRole('list', { name: 'Comments, oldest first' })
    expect([...list.querySelectorAll('li > p')].map((item) => item.textContent)).toEqual(['Earlier update', 'Middle update', 'Latest update'])
    expect(screen.queryByRole('button', { name: 'Load more comments' })).not.toBeInTheDocument()
  })

  it('retains failed drafts, provides explicit retry, and disables controls while retrying', async () => {
    let finish!: (comment: ReturnType<typeof makeComment>) => void
    vi.mocked(createComment).mockRejectedValueOnce(new Error('Post failed'))
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: '  Latest update  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Post comment' }))
    expect(await screen.findByText('Post failed')).toBeVisible()
    expect(screen.getByLabelText('Write a comment')).toHaveValue('  Latest update  ')
    fireEvent.click(screen.getByRole('button', { name: 'Retry comment' }))
    fireEvent.submit(screen.getByRole('form', { name: 'Post a comment' }))
    expect(createComment).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('Write a comment')).toBeDisabled()
    expect(vi.mocked(createComment).mock.calls[0][4]).toBe(vi.mocked(createComment).mock.calls[1][4])
    await act(async () => { finish(latest) })
    await waitFor(() => expect(screen.getByLabelText('Write a comment')).toHaveValue(''))
    expect(screen.getAllByText('Latest update')).toHaveLength(1)
  })

  it('blocks whitespace-only and oversized submissions and allows the exact length limit', async () => {
    render(<Harness />)
    const form = screen.getByRole('form', { name: 'Post a comment' })
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: ' \n ' } })
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeDisabled()
    fireEvent.submit(form)
    expect(screen.getByText('Comments must contain 1–2,000 characters.')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'a'.repeat(2001) } })
    fireEvent.submit(form)
    expect(createComment).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Write a comment')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Write a comment'), { target: { value: 'a'.repeat(2000) } })
    expect(screen.getByRole('button', { name: 'Post comment' })).toBeEnabled()
    expect(screen.getByText('2000/2000')).toBeVisible()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
