import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import type { Label } from '../../labels/types'
import type { TeamMember } from '../../team/types'
import { createTaskStore } from '../state/taskStore'

export function useTasks(client: AppClient | null, userId: string | undefined, lookups?: { members: TeamMember[]; labels: Label[] }, groupId?: string, onAccessError?: () => void) {
  const store = useMemo(() => createTaskStore(client, userId && groupId, onAccessError), [client, userId, groupId, onAccessError])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  const members = lookups?.members
  const labels = lookups?.labels
  const tasks = useMemo(() => {
    if (!members && !labels) return state.tasks
    const memberMap = new Map(members?.map((row) => [row.id, row]))
    const labelMap = new Map(labels?.map((row) => [row.id, row]))
    return state.tasks.map((task) => ({
      ...task,
      assignees: task.assignees.map((row) => memberMap.get(row.id) ?? row),
      labels: task.labels.map((row) => labelMap.get(row.id) ?? row),
    }))
  }, [state.tasks, members, labels])
  return {
    ...state, tasks, movingTaskIds: state.pendingIds,
    reload: store.reload, addTask: store.addTask, editTask: store.editTask,
    removeTask: store.removeTask, moveTask: store.moveTask, dismissNotice: store.dismissNotice,
  }
}
