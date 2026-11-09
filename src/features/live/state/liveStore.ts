import type { AppClient } from '../../../shared/lib/supabase'
import { observable } from '../../../shared/state/observable'
import type { LiveConnection } from '../types'
import { createRefreshQueue } from './refreshQueue'
import { createChannelSlot } from './channelSlot'

export function createLiveStore(client: AppClient, userId: string) {
  const state = observable({ connection: 'connecting' as LiveConnection })
  const queue = createRefreshQueue()
  let active = false
  let groupId: string | undefined
  let accountStatus = 'CONNECTING'
  let groupStatus = 'CONNECTING'
  let timer: ReturnType<typeof setInterval> | undefined
  function updateStatus() {
    if (!active) return
    const statuses = [accountStatus, ...(groupId ? [groupStatus] : [])]
    state.update({ connection: !navigator.onLine ? 'offline'
      : statuses.some((status) => ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) ? 'paused'
      : statuses.every((status) => status === 'SUBSCRIBED') ? 'live' : 'connecting' })
  }
  const account = createChannelSlot(client, (area) => queue.invalidate([area]), (status) => {
    accountStatus = status; updateStatus()
    if (status === 'SUBSCRIBED') queue.invalidate()
  })
  const group = createChannelSlot(client, (area) => {
    queue.invalidate([area], groupId)
    if (area === 'members') queue.invalidate(['board'], groupId)
  }, (status) => {
    groupStatus = status; updateStatus()
    if (status === 'SUBSCRIBED') queue.invalidate(undefined, groupId)
  })
  function connect() {
    if (!active || !navigator.onLine) { updateStatus(); return }
    queue.start()
    account.replace('northstar:account:' + userId)
    group.replace(groupId ? 'northstar:group:' + groupId : null)
  }
  function resume() {
    if (active && document.visibilityState === 'visible' && navigator.onLine) {
      queue.invalidate()
      if (state.getSnapshot().connection !== 'live') connect()
    }
  }
  function online() { connect(); queue.invalidate() }
  function offline() { queue.stop(); account.close(); group.close(); updateStatus() }
  return {
    ...state, register: queue.register,
    start() {
      active = true; queue.start(); connect()
      timer = setInterval(resume, 30_000)
      window.addEventListener('focus', resume); window.addEventListener('online', online); window.addEventListener('offline', offline)
      document.addEventListener('visibilitychange', resume)
    },
    stop() {
      active = false; queue.stop(); clearInterval(timer); account.close(); group.close()
      window.removeEventListener('focus', resume); window.removeEventListener('online', online); window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', resume)
    },
    selectGroup(next: string | undefined) {
      if (groupId === next) return
      groupId = next; groupStatus = 'CONNECTING'
      if (active && navigator.onLine) group.replace(next ? 'northstar:group:' + next : null)
      updateStatus()
    },
    retry: connect,
  }
}
export type LiveStore = ReturnType<typeof createLiveStore>
