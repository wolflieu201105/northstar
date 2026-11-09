import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import { useLiveRefresh } from '../../live/hooks/useLiveRefresh'
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
  useLiveRefresh('directory', store.groups.refresh)
  useLiveRefresh('profile', store.profile.refresh)
  useEffect(() => {
    store.profile.start(); store.groups.start()
    return () => { store.profile.stop(); store.groups.stop() }
  }, [store])
  return {
    profile: profile.items[0], profileLoading: profile.isLoading, profileError: profile.error,
    groups: groups.items, groupsLoading: groups.isLoading, groupsError: groups.error,
    reloadProfile: store.profile.reload, reloadGroups: store.groups.reload,
    saveProfile: (draft: ProfileDraft) => store.profile.mutate(userId, () => saveProfile(client, userId, draft)),
  }
}
export type IdentityData = ReturnType<typeof useIdentityData>
