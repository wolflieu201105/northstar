import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NavigationGuard } from '../state/navigationStore'
import { TeamMemberForm } from './TeamMemberForm'

describe('TeamMemberForm', () => {
  it('rejects blank and oversized names before a database write', () => {
    const save = vi.fn()
    render(<TeamMemberForm member={null} onSave={save} onClose={vi.fn()} registerGuard={() => () => {}} opener={null} />)
    const form = screen.getByRole('form', { name: 'Add team member' })
    fireEvent.change(screen.getByLabelText('Member name'), { target: { value: '   ' } })
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent('Member names must contain 1–80 characters.')
    expect(screen.getByLabelText('Member name')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Member name'), { target: { value: 'a'.repeat(81) } })
    fireEvent.submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Default')).toBeChecked()
  })

  it('protects changed profile drafts on cancellation and workspace navigation', () => {
    let guard: NavigationGuard | undefined
    const close = vi.fn()
    render(<TeamMemberForm member={null} onSave={vi.fn()} onClose={close} opener={null}
      registerGuard={(next) => { guard = next; return () => { guard = undefined } }} />)
    fireEvent.change(screen.getByLabelText('Member name'), { target: { value: 'Unsaved profile' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(close).not.toHaveBeenCalled()
    expect(guard?.()).toBe(false)
    confirm.mockReturnValue(true)
    expect(guard?.()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(close).toHaveBeenCalledOnce()
    confirm.mockRestore()
  })
})
