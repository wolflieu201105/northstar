import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { NavigationGuard } from '../../../shared/types/navigation'
import { makeLabel } from '../../../test/fixtures'
import { LabelForm } from './LabelForm'

const registerGuard = () => () => {}
describe('LabelForm', () => {
  it('rejects invalid names and case-insensitive active duplicates before writing', () => {
    const save = vi.fn()
    render(<LabelForm label={null} labels={[makeLabel()]} onSave={save} onRestore={vi.fn()} onClose={vi.fn()} registerGuard={registerGuard} opener={null} />)
    const form = screen.getByRole('form', { name: 'Add label' })
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent('Label names must contain 1–40 characters.')
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: 'a'.repeat(41) } })
    fireEvent.submit(form)
    expect(save).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: '  bUG  ' } })
    expect(screen.getByRole('alert')).toHaveTextContent('A label with this name already exists. Choose another name.')
    fireEvent.submit(form)
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add label' })).toBeDisabled()
  })

  it('offers an existing archived label and retains the draft after a failed restore', async () => {
    const archived = makeLabel({ archived_at: '2026-11-08T14:00:00Z', color: '#166b45' })
    const save = vi.fn()
    const close = vi.fn()
    const restore = vi.fn().mockRejectedValueOnce(new Error('Restore failed')).mockResolvedValueOnce(undefined)
    render(<LabelForm label={null} labels={[archived]} onSave={save} onRestore={restore} onClose={close} registerGuard={registerGuard} opener={null} />)
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: 'bug' } })
    fireEvent.click(screen.getByLabelText('Amber'))
    fireEvent.click(screen.getByRole('button', { name: 'Restore existing label' }))
    expect(await screen.findByText('Restore failed')).toBeVisible()
    expect(screen.getByLabelText('Label name')).toHaveValue('bug')
    expect(screen.getByLabelText('Amber')).toBeChecked()
    expect(close).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore existing label' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(restore).toHaveBeenLastCalledWith(archived)
    expect(save).not.toHaveBeenCalled()
  })

  it('allows a case-only rename of the same label and protects changed drafts', async () => {
    let guard: NavigationGuard | undefined
    const close = vi.fn()
    const save = vi.fn().mockResolvedValue(undefined)
    const label = makeLabel()
    render(<LabelForm label={label} labels={[label]} onSave={save} onRestore={vi.fn()} onClose={close} opener={null}
      registerGuard={(next) => { guard = next; return () => { guard = undefined } }} />)
    fireEvent.change(screen.getByLabelText('Label name'), { target: { value: '  BUG  ' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(close).not.toHaveBeenCalled()
    expect(guard?.()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save label' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith({ name: 'BUG', color: '#20895b' }))
    expect(close).toHaveBeenCalledOnce()
    confirm.mockRestore()
  })
})
