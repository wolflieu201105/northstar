import { vi } from 'vitest'
import type { AppClient } from '../shared/lib/supabase'

export function createRealtimeFake() {
  const channels: Array<{
    topic: string; stopped: boolean; message?: (message: { event: string; payload: object }) => void
    status?: (status: string) => void
  }> = []
  function makeChannel(topic: string, options?: object) {
    void options
    const record: typeof channels[number] = { topic, stopped: false }
    channels.push(record)
    const result = {
      on: vi.fn((_type: string, _filter: object, callback: typeof record.message) => { record.message = callback; return result }),
      subscribe: vi.fn((callback: typeof record.status) => { record.status = callback; return result }),
      teardown: vi.fn(() => { record.stopped = true }),
    }
    return Object.assign(result, { record, topic: 'realtime:' + topic })
  }
  async function disposeChannel(value: { record: typeof channels[number] }) { value.record.stopped = true; return 'ok' as const }
  const channel = vi.fn(makeChannel)
  const removeChannel = vi.fn(disposeChannel)
  return {
    client: { channel, removeChannel } as unknown as AppClient, channel, removeChannel, channels,
    emit(topic: string, event: string) { for (const row of channels) if (!row.stopped && row.topic === topic) row.message?.({ event, payload: {} }) },
    status(topic: string, status: string) { for (const row of channels) if (!row.stopped && row.topic === topic) row.status?.(status) },
    clear() { for (const row of channels) row.stopped = true; channels.length = 0; channel.mockImplementation(makeChannel); removeChannel.mockImplementation(disposeChannel) },
  }
}
export const realtimeFake = createRealtimeFake()
