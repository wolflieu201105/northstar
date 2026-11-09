import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { WorkspaceController } from '../hooks/useWorkspaceController'
import { AppHeader } from './AppHeader'
import { NoticeToast } from './NoticeToast'

interface WorkspaceShellProps {
  userId: string
  controller: WorkspaceController
  children: ReactNode
  dialogs: ReactNode
}

export function WorkspaceShell({ userId, controller, children, dialogs }: WorkspaceShellProps) {
  const { navigation, openCreate, visit, taskState } = controller
  return <div className="app-shell">
    <AppHeader guestId={userId} view={navigation.view} onVisit={visit} onCreateTask={() => openCreate()} />
    <main id="main-content" className="main-content">{children}</main>
    <button className="mobile-create" type="button" onClick={() => openCreate()}><Plus size={20} /> <span>New task</span></button>
    {taskState.notice && <NoticeToast notice={taskState.notice} onDismiss={taskState.dismissNotice} />}
    {dialogs}
  </div>
}
