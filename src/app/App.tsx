import { ConfigurationState, ErrorState, LoadingState } from '../shared/components/AppStates'
import { supabase, supabaseConfigError } from '../shared/lib/supabase'
import { useWorkspaceController } from './hooks/useWorkspaceController'
import { WorkspaceShell } from './components/WorkspaceShell'
import { WorkspaceViews } from './components/WorkspaceViews'
import { WorkspaceDialogs } from './components/WorkspaceDialogs'

function App() {
  const controller = useWorkspaceController(supabase)
  const { session, isSessionLoading, sessionError, retrySession } = controller
  if (supabaseConfigError) return <ConfigurationState />
  if (isSessionLoading) return <LoadingState />
  if (sessionError || !session) {
    return <ErrorState title="We couldn't start your guest session."
      message={sessionError ?? 'No active guest session was returned.'} onRetry={retrySession} />
  }
  return <WorkspaceShell userId={session.user.id} controller={controller}
    dialogs={<WorkspaceDialogs client={supabase} userId={session.user.id} controller={controller} />}>
    <WorkspaceViews userId={session.user.id} controller={controller} />
  </WorkspaceShell>
}

export default App
