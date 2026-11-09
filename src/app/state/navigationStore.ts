import { observable } from '../../shared/state/observable'
import { TASK_PRIORITIES, type TaskPriority } from '../../features/tasks/types'

import type { WorkspaceView, NavigationGuard } from '../../shared/types/navigation'
import type { RelationFilter } from '../../shared/types/filters'

function readRelationFilter(url: URL, key: string, emptyValue: string): RelationFilter {
  const values = url.searchParams.getAll(key)
  const ids = [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  const normalized = ids.includes(emptyValue) ? [emptyValue] : ids
  if (values.join('\0') !== normalized.join('\0')) {
    url.searchParams.delete(key)
    normalized.forEach((value) => url.searchParams.append(key, value))
  }
  return normalized.includes(emptyValue) ? 'none' : normalized.length ? normalized : 'all'
}

export function parseWorkspaceLocation(href: string) {
  const url = new URL(href, window.location.origin)
  const requestedView = url.searchParams.get('view')
  const view: WorkspaceView = requestedView === 'team' || requestedView === 'labels' ? requestedView : 'board'
  if (view === 'board') url.searchParams.delete('view')
  if (view !== 'board') url.searchParams.delete('task')
  if (!url.searchParams.get('task')) url.searchParams.delete('task')
  const requestedPriority = url.searchParams.get('priority')
  const priority: TaskPriority | 'all' = TASK_PRIORITIES.includes(requestedPriority as TaskPriority)
    ? requestedPriority as TaskPriority : 'all'
  if (priority === 'all') url.searchParams.delete('priority')
  const assignee = readRelationFilter(url, 'assignee', 'unassigned')
  const label = readRelationFilter(url, 'label', 'unlabeled')
  return {
    href: `${url.pathname}${url.search}${url.hash}`,
    view, taskId: url.searchParams.get('task'), query: url.searchParams.get('q') ?? '', priority, assignee, label,
  }
}

export function createNavigationStore() {
  const state = observable(parseWorkspaceLocation(window.location.href))
  const guards = new Set<NavigationGuard>()
  let index = Number(window.history.state?.northstarIndex) || 0
  let recovering = false
  const canLeave = () => [...guards].every((guard) => guard())
  function writeIndex(href: string) {
    window.history.replaceState({ ...window.history.state, northstarIndex: index }, '', href)
  }
  function onPopState(event: PopStateEvent) {
    if (recovering) { recovering = false; return }
    const next = parseWorkspaceLocation(window.location.href)
    const nextIndex = event.state?.northstarIndex
    if (next.href !== state.getSnapshot().href && !canLeave()) {
      if (typeof nextIndex === 'number' && nextIndex !== index) {
        recovering = true
        window.history.go(index - nextIndex)
      } else {
        // Untracked, same-origin history entry: restore the app without leaving a draft behind.
        window.history.pushState({ northstarIndex: index }, '', state.getSnapshot().href)
      }
      return
    }
    index = typeof nextIndex === 'number' ? nextIndex : index + 1
    writeIndex(next.href)
    state.update(next)
  }
  function change(patch: Record<string, string | string[] | null>, replace = false, force = false) {
    if (recovering && !force) return false
    const url = new URL(state.getSnapshot().href, window.location.origin)
    for (const [key, value] of Object.entries(patch)) {
      if (Array.isArray(value)) {
        url.searchParams.delete(key)
        value.forEach((item) => url.searchParams.append(key, item))
      } else if (value === null || value === '') url.searchParams.delete(key)
      else url.searchParams.set(key, value)
    }
    const next = parseWorkspaceLocation(url.href)
    if (next.href === state.getSnapshot().href) return true
    if (!force && !canLeave()) return false
    if (!replace) ++index
    window.history[replace ? 'replaceState' : 'pushState']({ ...window.history.state, northstarIndex: index }, '', next.href)
    state.update(next)
    return true
  }
  return {
    ...state,
    start() { writeIndex(state.getSnapshot().href); window.addEventListener('popstate', onPopState) },
    stop() { window.removeEventListener('popstate', onPopState) },
    registerGuard(guard: NavigationGuard) { guards.add(guard); return () => { guards.delete(guard) } },
    visit(view: WorkspaceView) { return change({ view: view === 'board' ? null : view, task: null }) },
    openTask(taskId: string) { return change({ view: null, task: taskId }) },
    closeTask() { return change({ task: null }, true) },
    taskDeleted() { return change({ task: null }, true, true) },
    setQuery(query: string) { return change({ q: query }, true) },
    setPriority(priority: TaskPriority | 'all') { return change({ priority: priority === 'all' ? null : priority }, true) },
    setAssignee(value: RelationFilter) { return change({ assignee: value === 'all' ? null : value === 'none' ? 'unassigned' : value }, true) },
    setLabel(value: RelationFilter) { return change({ label: value === 'all' ? null : value === 'none' ? 'unlabeled' : value }, true) },
    clearFilters() { return change({ q: null, priority: null, assignee: null, label: null }, true) },
  }
}
