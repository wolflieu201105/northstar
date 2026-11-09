import { useState } from 'react'
import type { AppClient } from '../../shared/lib/supabase'
import { useGuestSession } from '../../features/auth/useGuestSession'
import { useWorkspaceData } from '../../features/workspace/useWorkspaceData'
import { useTasks } from '../../features/tasks/hooks/useTasks'
import { useWorkspaceNavigation } from './useWorkspaceNavigation'
import type { WorkspaceView } from '../../shared/types/navigation'
import type { Task, TaskStatus } from '../../features/tasks/types'

interface CreateDialog {
  location: string
  defaultStatus: TaskStatus
  opener: HTMLElement | null
}

export function useWorkspaceController(client: AppClient | null) {
  const { session, isLoading: isSessionLoading, error: sessionError, retry: retrySession } = useGuestSession(client)
  const workspace = useWorkspaceData(client, session?.user.id)
  const taskState = useTasks(client, session?.user.id, workspace)
  const navigation = useWorkspaceNavigation()
  const [createDialog, setCreateDialog] = useState<CreateDialog | null>(null)
  const [detailOpener, setDetailOpener] = useState<HTMLElement | null>(null)

  const openCreate = (status: TaskStatus = 'todo') => {
    if (navigation.taskId) return
    setCreateDialog({ location: navigation.href, defaultStatus: status, opener: document.activeElement as HTMLElement | null })
  }
  const openTask = (task: Task) => {
    const opener = document.activeElement as HTMLElement | null
    if (navigation.openTask(task.id)) setDetailOpener(opener)
  }
  const visit = (view: WorkspaceView) => {
    if (navigation.visit(view)) window.requestAnimationFrame(() => {
      document.getElementById(view === 'board' ? 'board-title' : 'workspace-title')?.focus({ preventScroll: true })
    })
  }
  return {
    session, isSessionLoading, sessionError, retrySession,
    workspace, taskState, navigation, createDialog, detailOpener,
    openCreate, openTask, visit, closeCreate: () => setCreateDialog(null),
  }
}

export type WorkspaceController = ReturnType<typeof useWorkspaceController>
