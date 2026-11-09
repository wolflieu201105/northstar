import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import { createResource } from '../../../shared/state/resource'
import { fetchProfile, saveProfile } from '../services/profiles'
import { fetchGroups } from '../../groups/services/groups'
import type { ProfileDraft } from '../types'

export function useIdentityData(client: AppClient, userId: string) {
  const store = useMemo(() => ({
    profile: createResource(async () => [await fetchProfile(client, userId)]),
    groups: createResource(() => fetchGroups(client)),
  }), [client, userId])
  const profile = useSyncExternalStore(store.profile.subscribe, store.profile.getSnapshot)
  const groups = useSyncExternalStore(store.groups.subscribe, store.groups.getSnapshot)
  useEffect(() => {
    store.profile.start(); store.groups.start()
    const resume = () => { if (document.visibilityState === 'visible') { void store.groups.reload(); void store.profile.reload() } }
    window.addEventListener('focus', resume)
    document.addEventListener('visibilitychange', resume)
    return () => { store.profile.stop(); store.groups.stop(); window.removeEventListener('focus', resume); document.removeEventListener('visibilitychange', resume) }
  }, [store])
  return {
    profile: profile.items[0], profileLoading: profile.isLoading, profileError: profile.error,
    groups: groups.items, groupsLoading: groups.isLoading, groupsError: groups.error,
    reloadProfile: store.profile.reload, reloadGroups: store.groups.reload,
    saveProfile: (draft: ProfileDraft) => store.profile.mutate(userId, () => saveProfile(client, userId, draft)),
  }
}
export type IdentityData = ReturnType<typeof useIdentityData>
