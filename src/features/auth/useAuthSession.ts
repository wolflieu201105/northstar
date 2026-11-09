import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../shared/lib/supabase'
import { createAuthStore, type AuthStore } from './authStore'

const stores = new WeakMap<AppClient, AuthStore>()
function getStore(client: AppClient) {
  let store = stores.get(client)
  if (!store) { store = createAuthStore(client); stores.set(client, store) }
  return store
}
export function useAuthSession(client: AppClient) {
  const store = useMemo(() => getStore(client), [client])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  return { ...store, ...state }
}
export type AuthController = ReturnType<typeof useAuthSession>
