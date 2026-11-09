import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useDraftProtection } from '../../shared/hooks/useDraftProtection'
import type { AppClient } from '../../shared/lib/supabase'
import { useActiveGroupSync } from '../../features/live/hooks/useLiveRefresh'
import { useIdentityData } from '../../features/account/hooks/useIdentityData'
import { useWorkspaceData } from '../../features/workspace/useWorkspaceData'
import { useTasks } from '../../features/tasks/hooks/useTasks'
import { useWorkspaceNavigation } from './useWorkspaceNavigation'
import type { WorkspaceView } from '../../shared/types/navigation'
import type { Task, TaskStatus } from '../../features/tasks/types'

interface CreateDialog { location: string; defaultStatus: TaskStatus; opener: HTMLElement | null }
export function useWorkspaceController(client: AppClient, session: Session) {
  const identity = useIdentityData(client, session.user.id)
  const navigation = useWorkspaceNavigation()
  const group = identity.groups.find((row) => row.id === navigation.groupId)
  const groupId = group?.id
  useActiveGroupSync(groupId)
  const workspace = useWorkspaceData(client, session.user.id, groupId, identity.reloadGroups)
  const taskState = useTasks(client, session.user.id, workspace, groupId, identity.reloadGroups)
  useDraftProtection(false, taskState.pendingIds.size > 0, navigation.registerGuard)
  const previousGroup = useRef<string | undefined>(undefined)
  const [createDialog, setCreateDialog] = useState<CreateDialog | null>(null)
  const [detailOpener, setDetailOpener] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (identity.groupsLoading || identity.groupsError) return
    if (!navigation.groupId && identity.groups.length) navigation.selectGroup(identity.groups[0].id, true, true, true)
    else if (previousGroup.current === navigation.groupId && !groupId) {
      // Confirmed access loss takes precedence over drafts; the server has revoked access.
      navigation.selectGroup(identity.groups[0]?.id ?? null, true, true)
    }
    previousGroup.current = groupId
  }, [groupId, identity.groups, identity.groupsLoading, identity.groupsError, navigation])

  useEffect(() => {
    document.getElementById(navigation.view === 'board' ? 'board-title' : 'workspace-title')?.focus({ preventScroll: true })
  }, [navigation.view, groupId])

  const openCreate = (status: TaskStatus = 'todo') => {
    if (navigation.taskId || !groupId) return
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
  const refreshGroup = async () => {
    await identity.reloadGroups()
    await Promise.all([workspace.reloadMembers(), workspace.reloadLabels(), taskState.reload()])
  }
  return {
    session, client, identity, group, groupId, workspace, taskState, navigation, createDialog, detailOpener,
    openCreate, openTask, visit, refreshGroup, closeCreate: () => setCreateDialog(null),
  }
}
export type WorkspaceController = ReturnType<typeof useWorkspaceController>
