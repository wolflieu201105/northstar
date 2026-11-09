import type { AppClient } from '../../../shared/lib/supabase'
import type { RegisterNavigationGuard } from '../../../shared/hooks/useDraftProtection'
import type { useWorkspaceData } from '../../workspace/useWorkspaceData'
import type { useTaskDetails } from '../hooks/useTaskDetails'
import type { TaskInsert, TaskView } from '../types'
import type { WorkspaceView } from '../../../shared/types/navigation'

type Workspace = ReturnType<typeof useWorkspaceData>
export type Details = ReturnType<typeof useTaskDetails>
export interface TaskDetailPanelProps {
  client: AppClient | null
  userId: string
  task: TaskView | undefined
  isLoading: boolean
  loadError: string | null
  isTaskPending: boolean
  workspace: Workspace
  opener: HTMLElement | null
  registerGuard: RegisterNavigationGuard
  onClose: () => void
  onDeleted: () => void
  onRetry: () => void
  onVisit: (view: WorkspaceView) => void
  onSave: (input: TaskInsert, expectedUpdatedAt: string) => Promise<TaskView>
  onDelete: () => Promise<void>
}

