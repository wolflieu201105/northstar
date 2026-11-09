import { useMemo } from 'react'
import type { useTasks } from '../../tasks/hooks/useTasks'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import type { BoardFilters } from '../filters/types'
import { getFilterOptions, resolveFilter } from '../filters/options'

export function useBoardFilters(filters: BoardFilters, taskState: ReturnType<typeof useTasks>, workspace: ReturnType<typeof useWorkspaceData>) {
  const { tasks, isLoading, loadError } = taskState
  const members = useMemo(() => getFilterOptions(workspace.members, tasks.flatMap((task) => task.assignees)), [workspace.members, tasks])
  const labels = useMemo(() => getFilterOptions(workspace.labels, tasks.flatMap((task) => task.labels)), [workspace.labels, tasks])
  const tasksReady = !isLoading && !loadError
  const assignee = resolveFilter(filters.assignee, members, Boolean(tasksReady && !workspace.membersLoading && !workspace.memberError))
  const label = resolveFilter(filters.label, labels, Boolean(tasksReady && !workspace.labelsLoading && !workspace.labelError))
  const hasFilters = Boolean(filters.query.trim()) || filters.priority !== 'all' || assignee !== 'all' || label !== 'all'
  return { members, labels, assignee, label, hasFilters }
}
