import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeMember } from '../../../test/fixtures'
import { AssigneePicker } from './AssigneePicker'
import { BoardTeam } from './BoardTeam'

const members = Array.from({ length: 10 }, (_, index) => makeMember({ id: `member-${index}`, username: `member_${index}`, display_name: `Member ${index}` }))
function PickerExample() {
  const [selectedIds, setSelectedIds] = useState(['member-0'])
  return <AssigneePicker members={members} selectedIds={selectedIds} isLoading={false} error={null} onChange={setSelectedIds} onRetry={vi.fn()} />
}
describe('Real assignees and group presentation', () => {
  it('keeps a removable choice when an unsaved selection loses membership before being attached', () => {
    const change = vi.fn()
    render(<AssigneePicker members={[]} selectedIds={['removed-user']} isLoading={false} error={null} onChange={change} onRetry={vi.fn()} />)
    const former = screen.getByLabelText('Account removed-user (Unavailable)')
    expect(former).toBeChecked()
    expect(former).toBeEnabled()
    fireEvent.click(former)
    expect(change).toHaveBeenCalledWith([])
  })
  it('keeps selections when searching members and disambiguates display names with usernames', () => {
    render(<PickerExample />)
    fireEvent.change(screen.getByLabelText('Search assignees'), { target: { value: 'Member 9' } })
    expect(screen.queryByLabelText('Member 0 (@member_0)')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Member 9 (@member_9)'))
    expect(screen.getByText('2 selected')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Search assignees'), { target: { value: '' } })
    expect(screen.getByLabelText('Member 0 (@member_0)')).toBeChecked()
    expect(screen.getByLabelText('Member 9 (@member_9)')).toBeChecked()
  })
  it('exposes every accepted member name in the board strip', () => {
    const manage = vi.fn()
    render(<BoardTeam members={members} isLoading={false} error={null} onRetry={vi.fn()} onManage={manage} />)
    expect(screen.getByRole('img', { name: /^Active group members:/ })).toHaveAccessibleName(expect.stringContaining('Member 9 (@member_9)'))
    expect(screen.getByText('+5')).toBeVisible()
    expect(screen.getByText('10 active members')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Manage members' }))
    expect(manage).toHaveBeenCalledOnce()
  })
  it('lets a dirty draft remove an unavailable former assignee', () => {
    const former = makeMember({ id: 'former', username: 'former' })
    const change = vi.fn()
    render(<AssigneePicker members={[]} assignedMembers={[former]} selectedIds={['former']} isLoading={false} error={null} onChange={change} onRetry={vi.fn()} />)
    fireEvent.click(screen.getByLabelText('Alex Lee (@former) (Unavailable)'))
    expect(change).toHaveBeenCalledWith([])
  })
})
