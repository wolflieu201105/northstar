import type { PaginatedTimelineState, TimelineCursor, TimelinePage } from '../types/timeline'
import { observable } from './observable'
import { compareTimelineRows, isAfterTimelineCursor } from '../lib/timelineOrder'
import { serviceError } from '../services/errors'
import { TIMELINE_PAGE_SIZE } from '../services/timeline'

type Row = { id: string; created_at: string }
const cursorOf = (row: Row): TimelineCursor => ({ id: row.id, createdAt: row.created_at })
const merge = <T extends Row>(left: T[], right: T[]) => [...new Map([...left, ...right].map((row) => [row.id, row])).values()].sort(compareTimelineRows)

/** Append-only history with a contiguous older page and an optional recent suffix. */
export function createTimelineResource<T extends Row>(
  pageLoader: ((cursor?: TimelineCursor) => Promise<TimelinePage<T>>) | null,
  recentLoader: (() => Promise<T[]>) | null,
  onAccessError?: () => void,
) {
  const state = observable<PaginatedTimelineState<T>>({ items: [], nextCursor: null, isLoading: Boolean(pageLoader), isLoadingMore: false, failedLoadMore: false, error: null })
  const confirmed = new Map<string, T>()
  let active = false
  let loaded = false
  let pageRequest = 0
  let recentRequest = 0
  let recentFloor: T | undefined
  let needsRecent = false
  function report(error: unknown) {
    const problem = serviceError(error)
    if (problem.code === '42501') onAccessError?.()
    return problem.message
  }
  function closeGap(cursor: TimelineCursor | null) {
    return cursor && recentFloor && !isAfterTimelineCursor(recentFloor, cursor) ? null : cursor
  }
  async function load(more = false, preserve = false) {
    if (!active || !pageLoader) return
    const previous = state.getSnapshot()
    if (more && (previous.isLoading || !previous.nextCursor)) return
    const version = ++pageRequest
    if (!more && !preserve) { ++recentRequest; recentFloor = undefined }
    state.update({ isLoading: true, isLoadingMore: more, failedLoadMore: false, error: null })
    try {
      const page = await pageLoader(more ? previous.nextCursor! : undefined)
      if (!active || version !== pageRequest) return
      const current = state.getSnapshot()
      const retained = more || preserve ? current.items : [...confirmed.values()]
      const cursor = preserve && loaded ? current.nextCursor : page.nextCursor
      loaded = true
      state.update({ items: merge(retained, page.items), nextCursor: closeGap(cursor), isLoading: false, isLoadingMore: false })
    } catch (error) {
      if (active && version === pageRequest) state.update({ isLoading: false, isLoadingMore: false, failedLoadMore: more, error: report(error) })
    } finally {
      if (active && version === pageRequest && needsRecent) { needsRecent = false; void refresh() }
    }
  }
  async function refresh() {
    if (!active || !recentLoader) return
    if (state.getSnapshot().isLoading) { needsRecent = true; return }
    if (!loaded) { await load(); if (!loaded || !active) return }
    const version = ++recentRequest
    try {
      const recent = await recentLoader()
      if (!active || version !== recentRequest) return
      if (state.getSnapshot().isLoading) { needsRecent = true; return }
      const previous = state.getSnapshot()
      const last = previous.items.at(-1)
      recentFloor = recent[0]
      // More than one page may have arrived while disconnected. Keep a visible gap to fill.
      const gap = !previous.nextCursor && last && recentFloor && compareTimelineRows(recentFloor, last) > 0 && recent.length === TIMELINE_PAGE_SIZE
        ? cursorOf(last) : previous.nextCursor
      state.update({ items: merge(previous.items, recent), nextCursor: closeGap(gap), error: previous.failedLoadMore ? previous.error : null, failedLoadMore: previous.failedLoadMore })
    } catch (error) {
      if (active && version === recentRequest) state.update({ error: report(error) })
    }
  }
  return {
    ...state, load, refresh,
    retry() { return load(state.getSnapshot().failedLoadMore) },
    confirm(row: T) { confirmed.set(row.id, row); state.update({ items: merge(state.getSnapshot().items, [row]) }) },
    start() { active = true; void load() },
    stop() { active = false; ++pageRequest; ++recentRequest; needsRecent = false },
  }
}
