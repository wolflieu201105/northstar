import { AlertTriangle, Database, RefreshCw, Settings2 } from 'lucide-react'

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
        <Settings2 size={15} /> Follow the SQL and Auth setup instructions in the README.
      </p>
    </main>
  )
}

export function LoadingState({ message = 'Preparing your board…' }: { message?: string }) {
  return (
    <main className="centered-state" aria-live="polite">
      <div className="loading-orbit" aria-hidden="true">
        <span />
      </div>
      <span className="eyebrow">Northstar</span>
      <h1>{message}</h1>
      <p>Your account will be ready in a moment.</p>
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
