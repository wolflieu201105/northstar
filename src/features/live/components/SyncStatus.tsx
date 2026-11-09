import { useContext, useSyncExternalStore } from 'react'
import { LiveSyncContext } from '../context'
import type { LiveStore } from '../state/liveStore'

function ConnectedStatus({ store }: { store: LiveStore }) {
  const { connection } = useSyncExternalStore(store.subscribe, store.getSnapshot)
  return <aside className={`sync-status sync-${connection}`} aria-label="Live connection">
    <span className="sync-dot" aria-hidden="true" />
    <span role="status">{connection === 'live' ? 'Live updates' : connection === 'offline' ? 'Offline · updates paused'
      : connection === 'paused' ? 'Live updates paused · checking for changes periodically' : 'Connecting live updates…'}</span>
    {connection === 'paused' && <button type="button" className="text-button" onClick={store.retry}>Retry connection</button>}
  </aside>
}
export function SyncStatus() {
  const store = useContext(LiveSyncContext)
  return store ? <ConnectedStatus store={store} /> : null
}
