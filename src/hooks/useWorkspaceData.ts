import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../lib/supabase'
import { createWorkspaceStore } from '../state/workspaceStore'

export function useWorkspaceData(client: AppClient | null, userId: string | undefined) {
  const store = useMemo(() => createWorkspaceStore(client, userId), [client, userId])
  const memberState = useSyncExternalStore(store.members.subscribe, store.members.getSnapshot, store.members.getSnapshot)
  const labelState = useSyncExternalStore(store.labels.subscribe, store.labels.getSnapshot, store.labels.getSnapshot)
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
    addMember: store.addMember, editMember: store.editMember, setMemberArchived: store.setMemberArchived,
    addLabel: store.addLabel, editLabel: store.editLabel, setLabelArchived: store.setLabelArchived,
  }
}
