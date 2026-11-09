import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppClient } from '../../../shared/lib/supabase'
import { makeInvitation, makeMember } from '../../../test/fixtures'
import { lookupTarget, sendInvitation } from '../services/groups'
import { InviteForm } from './InviteForm'

vi.mock('../services/groups', () => ({ lookupTarget: vi.fn(), sendInvitation: vi.fn() }))
beforeEach(() => { vi.resetAllMocks() })
describe('invitation preview', () => {
  it('previews an actual account before sending and retries the same request on failure', async () => {
    const target = makeMember()
    vi.mocked(lookupTarget).mockResolvedValue(target)
    vi.mocked(sendInvitation).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(makeInvitation())
    const changed = vi.fn()
    render(<InviteForm client={{} as AppClient} groupId="group-1" registerGuard={() => () => {}} onSent={changed} />)
    fireEvent.change(screen.getByLabelText('Username or account ID'), { target: { value: target.username } })
    expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Find account' }))
    await screen.findByText('@alex_lee')
    expect(screen.getByText(target.id)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    await screen.findByText('Offline')
    expect(changed).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Username or account ID')).toHaveValue(target.username)
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
    expect(vi.mocked(sendInvitation).mock.calls[0][3]).toBe(vi.mocked(sendInvitation).mock.calls[1][3])
    expect(screen.getByLabelText('Username or account ID')).toHaveValue('')
  })
  it('invalidates a preview when the lookup text changes', async () => {
    vi.mocked(lookupTarget).mockResolvedValue(makeMember())
    render(<InviteForm client={{} as AppClient} groupId="group-1" registerGuard={() => () => {}} onSent={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Username or account ID'), { target: { value: 'alex_lee' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find account' }))
    await screen.findByRole('button', { name: 'Send invitation' })
    fireEvent.change(screen.getByLabelText('Username or account ID'), { target: { value: 'another_user' } })
    expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument()
    expect(sendInvitation).not.toHaveBeenCalled()
  })
})
