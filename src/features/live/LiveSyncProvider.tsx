import { useEffect, useMemo, type ReactNode } from 'react'
import type { AppClient } from '../../shared/lib/supabase'
import { createLiveStore } from './state/liveStore'
import { LiveSyncContext } from './context'

export function LiveSyncProvider({ client, userId, children }: { client: AppClient; userId: string; children: ReactNode }) {
  const store = useMemo(() => createLiveStore(client, userId), [client, userId])
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  return <LiveSyncContext.Provider value={store}>{children}</LiveSyncContext.Provider>
}
