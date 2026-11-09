import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardDate } from './useBoardDate'

beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }))
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('board local date', () => {
  it('refreshes at local midnight and releases its only timer on unmount', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59))
    const { result, unmount } = renderHook(useBoardDate)
    expect(result.current).toEqual(new Date(2026, 11, 31))
    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current).toEqual(new Date(2027, 0, 1))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('catches up when a backgrounded page becomes visible or regains focus', () => {
    vi.setSystemTime(new Date(2026, 10, 8, 23))
    const { result, unmount } = renderHook(useBoardDate)
    vi.setSystemTime(new Date(2026, 10, 10, 8))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current).toEqual(new Date(2026, 10, 8))
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(result.current).toEqual(new Date(2026, 10, 10))
    vi.setSystemTime(new Date(2026, 10, 11, 8))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current).toEqual(new Date(2026, 10, 11))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([new Date(2026, 2, 8), new Date(2026, 10, 1)])('schedules the next calendar midnight across DST (%s)', (date) => {
    vi.setSystemTime(date)
    const { result } = renderHook(useBoardDate)
    const nextDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    const delay = nextDay.getTime() - date.getTime()
    act(() => vi.advanceTimersByTime(delay - 1))
    expect(result.current).toEqual(date)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toEqual(nextDay)
  })

  it('removes visibility/focus listeners so a closed board cannot restart the clock', () => {
    vi.setSystemTime(new Date(2026, 10, 8))
    const { unmount } = renderHook(useBoardDate)
    unmount()
    act(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
    expect(vi.getTimerCount()).toBe(0)
  })
})
