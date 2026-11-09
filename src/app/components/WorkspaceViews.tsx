import { lazy, Suspense } from 'react'
import type { WorkspaceController } from '../hooks/useWorkspaceController'
import { BoardPage } from '../../features/board/pages/BoardPage'

const TeamPage = lazy(() => import('../../features/team/pages/TeamPage').then((module) => ({ default: module.TeamPage })))
const LabelsPage = lazy(() => import('../../features/labels/pages/LabelsPage').then((module) => ({ default: module.LabelsPage })))

export function WorkspaceViews({ controller, userId }: { controller: WorkspaceController; userId: string }) {
  const { navigation, workspace, taskState, openCreate, openTask, visit } = controller
  const managementProps = {
    workspace, tasks: taskState.tasks, tasksLoading: taskState.isLoading,
    taskError: taskState.loadError, registerGuard: navigation.registerGuard,
  }
  return <>
    <div hidden={navigation.view !== 'board'}>
      <BoardPage taskState={taskState} workspace={workspace} filters={navigation} isActive={navigation.view === 'board'}
        onCreate={openCreate} onOpenTask={openTask} onManageTeam={() => visit('team')} />
    </div>
    {navigation.view !== 'board' && <Suspense fallback={<p role="status">Loading workspace…</p>}>
      {navigation.view === 'team' ? <TeamPage key={userId} {...managementProps} /> : <LabelsPage key={userId} {...managementProps} />}
    </Suspense>}
  </>
}
