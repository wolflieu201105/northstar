import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { makeLabel } from '../../../test/fixtures'
import { LabelPicker } from './LabelPicker'
import { TaskLabelChips } from './TaskLabelChips'

const archived = makeLabel({ id: 'archived', name: 'Old label', archived_at: '2026-11-08T14:00:00Z' })
const labels = Array.from({ length: 10 }, (_, index) => makeLabel({ id: `label-${index}`, name: `Label ${index}` }))
function PickerExample() {
  const [selectedIds, setSelectedIds] = useState(['label-0', archived.id])
  return <LabelPicker labels={[...labels, archived, { ...archived, id: 'other-archived', name: 'Hidden archived' }]}
    linkedLabels={[archived]} selectedIds={selectedIds} isLoading={false} error={null} onChange={setSelectedIds} onRetry={vi.fn()} />
}

describe('Label selection and card chips', () => {
  it('preserves hidden search selections and permits removing only existing archived links', () => {
    render(<PickerExample />)
    expect(screen.queryByLabelText('Hidden archived (Archived)')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search labels'), { target: { value: 'Label 9' } })
    fireEvent.click(screen.getByLabelText('Label 9'))
    expect(screen.getByText('3 selected')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Search labels'), { target: { value: '' } })
    expect(screen.getByLabelText('Label 0')).toBeChecked()
    expect(screen.getByLabelText('Label 9')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Old label (Archived)'))
    expect(screen.getByLabelText('Old label (Archived)')).not.toBeChecked()
    expect(screen.getByLabelText('Old label (Archived)')).toBeDisabled()
  })

  it('renders label names as text and expands overflow with archived markers', () => {
    const literal = '<img src=x onerror=alert(1)>'
    render(<TaskLabelChips labels={[makeLabel({ name: literal }), makeLabel({ id: 'second', name: 'Feature' }), archived]} />)
    const chips = screen.getByRole('group', { name: 'Task labels' })
    expect(within(chips).getByText(literal)).toBeVisible()
    expect(chips.querySelector('img')).toBeNull()
    expect(within(chips).queryByText('Old label')).not.toBeVisible()
    fireEvent.click(screen.getByText('+1'))
    expect(chips.querySelector('details')).toHaveAttribute('open')
    expect(within(chips).getByText('Old label')).toBeVisible()
    expect(within(chips).getByText('Archived')).toBeVisible()
  })
})
