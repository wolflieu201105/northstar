import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import { createResource } from '../../../shared/state/resource'
import { useLiveRefresh } from '../../live/hooks/useLiveRefresh'
import { fetchMembers } from '../services/groups'

export function useMembers(client: AppClient, userId: string, groupId: string) {
  const store = useMemo(() => createResource(async () => {
    if (!userId) return []
    return (await fetchMembers(client, groupId)).map((row) => ({ ...row, id: row.user_id }))
  }), [client, userId, groupId])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useLiveRefresh('members', store.refresh, groupId)
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  return { ...state, reload: store.reload }
}
