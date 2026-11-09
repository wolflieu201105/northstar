import { LayoutDashboard, Plus, ShieldCheck, Sparkles, Tags, Users } from 'lucide-react'
import type { WorkspaceView } from '../../shared/types/navigation'

interface AppHeaderProps {
  guestId: string
  onCreateTask: () => void
  view: WorkspaceView
  onVisit: (view: WorkspaceView) => void
}

export function AppHeader({ guestId, view, onVisit, onCreateTask }: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="brand" href="?" onClick={(event) => { event.preventDefault(); onVisit('board') }} aria-label="Northstar board home">
        <span className="brand-mark" aria-hidden="true">
          <Sparkles size={19} strokeWidth={2.4} />
        </span>
        <span>
          <strong>Northstar</strong>
          <small>Project board</small>
        </span>
      </a>

      <nav className="workspace-nav" aria-label="Workspace">
        {([{ view: 'board', label: 'Board', icon: LayoutDashboard }, { view: 'team', label: 'Team', icon: Users }, { view: 'labels', label: 'Labels', icon: Tags }] as const).map((item) =>
          <button type="button" key={item.view} aria-current={view === item.view ? 'page' : undefined} onClick={() => onVisit(item.view)}>
            <item.icon size={16} aria-hidden="true" /><span>{item.label}</span>
          </button>)}
      </nav>

      <div className="header-actions">
        <div className="guest-pill" title="Tasks are private to this browser's guest session">
          <span className="presence-dot" aria-hidden="true" />
          <span>Guest {guestId.slice(0, 5).toUpperCase()}</span>
          <ShieldCheck size={15} aria-label="Private session" />
        </div>
        <button className="button button-primary header-create" type="button" onClick={onCreateTask}>
          <Plus size={18} />
          <span>New task</span>
        </button>
      </div>
    </header>
  )
}
