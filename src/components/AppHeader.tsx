import { Plus, ShieldCheck, Sparkles } from 'lucide-react'

interface AppHeaderProps {
  guestId: string
  onCreateTask: () => void
}

export function AppHeader({ guestId, onCreateTask }: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="brand" href="#main-content" aria-label="Northstar board home">
        <span className="brand-mark" aria-hidden="true">
          <Sparkles size={19} strokeWidth={2.4} />
        </span>
        <span>
          <strong>Northstar</strong>
          <small>Project board</small>
        </span>
      </a>

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
