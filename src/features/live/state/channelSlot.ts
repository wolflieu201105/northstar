import type { RealtimeChannel } from '@supabase/supabase-js'
import type { AppClient } from '../../../shared/lib/supabase'
import { LIVE_AREAS, type LiveArea } from '../types'

/** Await disposal before reusing a topic, including StrictMode and rapid switching. */
const closingTopics = new WeakMap<AppClient, Map<string, Promise<unknown>>>()
function pendingFor(client: AppClient) {
  let topics = closingTopics.get(client)
  if (!topics) { topics = new Map(); closingTopics.set(client, topics) }
  return topics
}

export function createChannelSlot(client: AppClient, onChange: (area: LiveArea) => void, onStatus: (status: string) => void) {
  let channel: RealtimeChannel | null = null
  let generation = 0
  let disposal: Promise<unknown> = Promise.resolve()
  function replace(topic: string | null) {
    const version = ++generation
    const previous = channel
    channel = null
    if (previous) {
      const topics = pendingFor(client)
      disposal = Promise.allSettled([disposal, topics.get(previous.topic)])
        .then(() => client.removeChannel(previous)).finally(() => previous.teardown())
      const retired = disposal
      topics.set(previous.topic, retired)
      void retired.finally(() => { if (topics.get(previous.topic) === retired) topics.delete(previous.topic) }).catch(() => {})
    }
    if (!topic) return
    onStatus('CONNECTING')
    const previousOwner = pendingFor(client).get('realtime:' + topic)
    void Promise.allSettled([disposal, previousOwner]).then(() => {
      if (generation !== version) return
      channel = client.channel(topic, { config: { private: true } })
        .on('broadcast', { event: '*' }, (message: { event: string }) => {
          if (generation === version && LIVE_AREAS.includes(message.event as LiveArea)) onChange(message.event as LiveArea)
        })
        .subscribe((status) => { if (generation === version) onStatus(status) })
    }).catch(() => { if (generation === version) onStatus('CHANNEL_ERROR') })
  }
  return { replace, close: () => replace(null) }
}
