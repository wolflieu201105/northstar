import { describe, expect, it } from 'vitest'
import { relativeActivityTime } from './relativeTime'

const now = Date.parse('2026-11-09T06:00:00Z')
describe('activity relative timestamps', () => {
  it.each([
    { offset: -59_000, label: 'Just now' },
    { offset: -60_000, label: '1 minute ago' },
    { offset: -2 * 60 * 60_000, label: '2 hours ago' },
    { offset: -3 * 24 * 60 * 60_000, label: '3 days ago' },
    { offset: 2 * 60_000, label: 'in 2 minutes' },
  ])('shows $label', ({ offset, label }) => {
    expect(relativeActivityTime(new Date(now + offset).toISOString(), now, 'en')).toBe(label)
  })
  it('has a safe fallback for an invalid timestamp', () => {
    expect(relativeActivityTime('invalid', now, 'en')).toBe('Time unavailable')
  })
})
