import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import type { WorkspaceController } from '../hooks/useWorkspaceController'
import { AppHeader } from './AppHeader'
import { NoticeToast } from './NoticeToast'

export function WorkspaceShell({ controller, children }: { controller: WorkspaceController; children: ReactNode }) {
  const { openCreate, taskState, groupId } = controller
  return <div className="app-shell">
    <AppHeader controller={controller} />
    <main id="main-content" className="main-content">{children}</main>
    {groupId && <button className="mobile-create" type="button" onClick={() => openCreate()}><Plus size={20} /> <span>New task</span></button>}
    {taskState.notice && <NoticeToast notice={taskState.notice} onDismiss={taskState.dismissNotice} />}
  </div>
}
