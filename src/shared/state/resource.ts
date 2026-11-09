import { serviceError } from '../services/errors'
import { observable } from './observable'

export function createResource<Row extends { id: string }>(loader: (() => Promise<Row[]>) | null) {
  const state = observable({ items: [] as Row[], isLoading: Boolean(loader), error: null as string | null })
  let active = false
  let hasLoaded = false
  let request = 0
  let mutations = 0
  let needsReload = false
  const pending = new Set<string>()
  async function reload(background = false) {
    if (!loader || !active) return
    const version = ++request
    const mutationVersion = mutations
    state.update({ isLoading: !background || !hasLoaded, error: null })
    try {
      const rows = await loader()
      if (!active || version !== request) return
      if (mutationVersion !== mutations || pending.size) {
        needsReload = true
        state.update({ isLoading: false })
        if (!pending.size) { needsReload = false; void reload(true) }
        return
      }
      hasLoaded = true
      state.update({ items: rows, isLoading: false })
    } catch (reason) {
      if (active && version === request) state.update({ error: serviceError(reason).message, isLoading: false })
    }
  }
  async function mutate(id: string, operation: () => Promise<Row>) {
    if (pending.has(id)) throw new Error('This record is already saving.')
    pending.add(id)
    ++mutations
    try {
      const row = await operation()
      state.update((previous) => ({ ...previous, items: [...previous.items.filter((item) => item.id !== row.id), row] }))
      return row
    } finally {
      pending.delete(id)
      ++mutations
      if (!pending.size && needsReload) { needsReload = false; void reload(true) }
    }
  }
  return {
    ...state,
    start() { active = true; void reload(true) },
    stop() { active = false; ++request },
    reload: () => reload(),
    refresh: () => reload(true),
    mutate,
  }
}
