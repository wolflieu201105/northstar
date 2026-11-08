import { AlertTriangle, ArrowRight, Database, RefreshCw, Settings2 } from 'lucide-react'

export function ConfigurationState() {
  return (
    <main className="centered-state configuration-state">
      <div className="state-illustration config-illustration" aria-hidden="true">
        <Database size={28} />
        <span />
      </div>
      <span className="eyebrow">One quick setup</span>
      <h1>Connect your private task board</h1>
      <p>
        Northstar is ready. Add your Supabase project URL and publishable key, then restart the
        development server.
      </p>
      <div className="config-steps">
        <div>
          <span>1</span>
          <p>Copy <code>.env.example</code> to <code>.env.local</code></p>
        </div>
        <div>
          <span>2</span>
          <p>Replace both placeholder values</p>
        </div>
        <div>
          <span>3</span>
          <p>Enable anonymous sign-ins in Supabase</p>
        </div>
      </div>
      <p className="state-note">
        <Settings2 size={15} /> Database schema setup comes in the next checkpoint.
      </p>
    </main>
  )
}

export function LoadingState({ message = 'Preparing your private board…' }: { message?: string }) {
  return (
    <main className="centered-state" aria-live="polite">
      <div className="loading-orbit" aria-hidden="true">
        <span />
      </div>
      <span className="eyebrow">Northstar</span>
      <h1>{message}</h1>
      <p>Your guest workspace will be ready in a moment.</p>
    </main>
  )
}

export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <main className="centered-state">
      <div className="state-illustration error-illustration" aria-hidden="true">
        <AlertTriangle size={28} />
      </div>
      <span className="eyebrow">Connection interrupted</span>
      <h1>{title}</h1>
      <p>{message}</p>
      <button className="button button-primary" type="button" onClick={onRetry}>
        <RefreshCw size={17} /> Try again
      </button>
    </main>
  )
}

export function EmptyBoardState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-board">
      <div className="empty-board-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div>
        <span className="eyebrow">A clean slate</span>
        <h2>Turn the first idea into momentum.</h2>
        <p>Create a task, give it a priority, then move it across the board as work progresses.</p>
      </div>
      <button className="button button-primary" type="button" onClick={onCreate}>
        Create your first task <ArrowRight size={17} />
      </button>
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="board-grid skeleton-grid" aria-label="Loading tasks" aria-busy="true">
      {[0, 1, 2, 3].map((column) => (
        <div className="skeleton-column" key={column}>
          <span className="skeleton skeleton-title" />
          <span className="skeleton skeleton-subtitle" />
          {[0, 1].map((card) => (
            <div className="skeleton-card" key={card}>
              <span className="skeleton skeleton-chip" />
              <span className="skeleton skeleton-line" />
              <span className="skeleton skeleton-line short" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
