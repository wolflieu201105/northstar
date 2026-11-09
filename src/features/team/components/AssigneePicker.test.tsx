import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeMember } from '../../../test/fixtures'
import { AssigneePicker } from './AssigneePicker'
import { BoardTeam } from './BoardTeam'

const members = Array.from({ length: 10 }, (_, index) => makeMember({ id: `member-${index}`, name: `Member ${index}` }))
function PickerExample() {
  const [selectedIds, setSelectedIds] = useState(['member-0'])
  return <AssigneePicker members={members} selectedIds={selectedIds} isLoading={false} error={null} onChange={setSelectedIds} onRetry={vi.fn()} />
}

describe('Assignees and team presentation', () => {
  it('keeps selections when searching a large team', () => {
    render(<PickerExample />)
    fireEvent.change(screen.getByLabelText('Search assignees'), { target: { value: 'Member 9' } })
    expect(screen.queryByLabelText('Member 0')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Member 9'))
    expect(screen.getByText('2 selected')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Search assignees'), { target: { value: '' } })
    expect(screen.getByLabelText('Member 0')).toBeChecked()
    expect(screen.getByLabelText('Member 9')).toBeChecked()
  })

  it('excludes archived members from the board strip and exposes every overflow name', () => {
    const archived = makeMember({ id: 'archived', name: 'Archived profile', archived_at: '2026-11-08T14:00:00Z' })
    const manage = vi.fn()
    render(<BoardTeam members={[...members, archived]} isLoading={false} error={null} onRetry={vi.fn()} onManage={manage} />)
    const avatars = screen.getByRole('img', { name: /^Active team members:/ })
    expect(avatars).toHaveAccessibleName(expect.stringContaining('Member 9'))
    expect(avatars).not.toHaveAccessibleName(expect.stringContaining('Archived profile'))
    expect(screen.getByText('+5')).toBeVisible()
    expect(screen.getByText('10 active members')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Manage team' }))
    expect(manage).toHaveBeenCalledOnce()
  })
})
