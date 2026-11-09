import { ConfigurationState, LoadingState } from '../shared/components/AppStates'
import { supabase, supabaseConfigError, type AppClient } from '../shared/lib/supabase'
import { useAuthSession, type AuthController } from '../features/auth/useAuthSession'
import { LiveSyncProvider } from '../features/live/LiveSyncProvider'
import { AuthEntry } from '../features/auth/AuthEntry'
import { useWorkspaceController } from './hooks/useWorkspaceController'
import { WorkspaceShell } from './components/WorkspaceShell'
import { WorkspaceViews } from './components/WorkspaceViews'
import { WorkspaceDialogs } from './components/WorkspaceDialogs'

function WorkspaceApp({ client, auth }: { client: AppClient; auth: AuthController }) {
  const controller = useWorkspaceController(client, auth.session!)
  return <WorkspaceShell controller={controller}>
    <WorkspaceViews controller={controller} auth={auth} />
    {controller.groupId && <WorkspaceDialogs client={client} userId={auth.session!.user.id} controller={controller} />}
  </WorkspaceShell>
}
function ConnectedApp({ client }: { client: AppClient }) {
  const auth = useAuthSession(client)
  if (auth.isLoading) return <LoadingState />
  if (!auth.session) return <AuthEntry auth={auth} />
  return <LiveSyncProvider key={auth.session.user.id} client={client} userId={auth.session.user.id}>
    <WorkspaceApp client={client} auth={auth} />
  </LiveSyncProvider>
}
export default function App() {
  if (supabaseConfigError || !supabase) return <ConfigurationState />
  return <ConnectedApp client={supabase} />
}
