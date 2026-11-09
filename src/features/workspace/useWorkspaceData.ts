import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../shared/lib/supabase'
import { useLiveRefresh } from '../live/hooks/useLiveRefresh'
import { createWorkspaceStore } from './workspaceStore'

export function useWorkspaceData(client: AppClient | null, userId: string | undefined, groupId?: string, onAccessError?: () => void) {
  const store = useMemo(() => createWorkspaceStore(client, userId, groupId, onAccessError), [client, userId, groupId, onAccessError])
  const memberState = useSyncExternalStore(store.members.subscribe, store.members.getSnapshot, store.members.getSnapshot)
  const labelState = useSyncExternalStore(store.labels.subscribe, store.labels.getSnapshot, store.labels.getSnapshot)
  useLiveRefresh('members', store.members.refresh, groupId)
  useLiveRefresh('labels', store.labels.refresh, groupId)
  useEffect(() => {
    store.members.start()
    store.labels.start()
    return () => { store.members.stop(); store.labels.stop() }
  }, [store])
  return {
    members: memberState.items, labels: labelState.items,
    membersLoading: memberState.isLoading, labelsLoading: labelState.isLoading,
    memberError: memberState.error, labelError: labelState.error,
    reloadMembers: store.members.reload, reloadLabels: store.labels.reload,
    addLabel: store.addLabel, editLabel: store.editLabel, setLabelArchived: store.setLabelArchived,
  }
}
