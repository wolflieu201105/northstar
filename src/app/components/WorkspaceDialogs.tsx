import { lazy, Suspense } from 'react'
import type { AppClient } from '../../shared/lib/supabase'
import type { WorkspaceController } from '../hooks/useWorkspaceController'

const TaskForm = lazy(() => import('../../features/tasks/components/TaskForm').then((module) => ({ default: module.TaskForm })))
const TaskDetailPanel = lazy(() => import('../../features/tasks/details/TaskDetailPanel').then((module) => ({ default: module.TaskDetailPanel })))

interface WorkspaceDialogsProps { client: AppClient | null; userId: string; controller: WorkspaceController }

export function WorkspaceDialogs({ client, userId, controller }: WorkspaceDialogsProps) {
  const { navigation, workspace, taskState, createDialog, detailOpener, closeCreate, visit } = controller
  const taskId = navigation.taskId
  const groupId = controller.groupId
  const selectedTask = taskState.tasks.find((task) => task.id === taskId)
  return <>
    {groupId && createDialog && createDialog.location === navigation.href && !taskId && <Suspense fallback={null}>
      <TaskForm key={`${userId}:${groupId}`} task={null} defaultStatus={createDialog.defaultStatus} opener={createDialog.opener}
        onSave={async (input) => { await taskState.addTask(input) }} onClose={closeCreate}
        registerGuard={navigation.registerGuard} workspace={workspace}
        onManageTeam={navigation.view === 'members' ? undefined : () => visit('members')}
        onManageLabels={navigation.view === 'labels' ? undefined : () => visit('labels')} />
    </Suspense>}
    {groupId && taskId && <Suspense fallback={<p className="detail-loading-notice" role="status">Opening task details…</p>}>
      <TaskDetailPanel key={`${userId}:${groupId}:${taskId}`} client={client} userId={userId} groupId={groupId} onAccessError={controller.identity.reloadGroups} task={selectedTask}
        isLoading={taskState.isLoading} loadError={taskState.loadError} isTaskPending={taskState.movingTaskIds.has(taskId)}
        workspace={workspace} opener={detailOpener} registerGuard={navigation.registerGuard}
        onClose={navigation.closeTask} onDeleted={navigation.taskDeleted} onRetry={taskState.reload} onVisit={visit}
        onSave={(input, token) => taskState.editTask(taskId, input, token)} onDelete={() => taskState.removeTask(taskId)} />
    </Suspense>}
  </>
}
