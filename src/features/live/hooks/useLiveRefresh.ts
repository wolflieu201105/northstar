import { useContext, useEffect } from 'react'
import { LiveSyncContext } from '../context'
import type { LiveArea, Refresh } from '../types'

export function useLiveRefresh(area: LiveArea, refresh: Refresh, groupId?: string) {
  const live = useContext(LiveSyncContext)
  useEffect(() => live?.register(area, refresh, groupId), [live, area, refresh, groupId])
}
export function useActiveGroupSync(groupId?: string) {
  const live = useContext(LiveSyncContext)
  useEffect(() => {
    live?.selectGroup(groupId)
    return () => live?.selectGroup(undefined)
  }, [live, groupId])
}
