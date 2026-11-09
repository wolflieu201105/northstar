export function observable<State>(initial: State) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    update(change: Partial<State> | ((previous: State) => State)) {
      state = typeof change === 'function' ? change(state) : { ...state, ...change }
      listeners.forEach((listener) => listener())
    },
  }
}
