import { useEffect, useState, useSyncExternalStore } from 'react'
import { createNavigationStore } from '../state/navigationStore'

export function useWorkspaceNavigation() {
  const [store] = useState(createNavigationStore)
  const location = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  return { ...location, ...store }
}
