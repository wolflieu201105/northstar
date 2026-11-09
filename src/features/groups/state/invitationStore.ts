import type { AppClient } from '../../../shared/lib/supabase'
import type { Invitation } from '../types'
import type { TimelineCursor } from '../../../shared/types/timeline'
import { observable } from '../../../shared/state/observable'
import { fetchInvitations } from '../services/groups'
import { serviceError } from '../../../shared/services/errors'

export function createInvitationStore(client: AppClient, userId: string) {
  const state = observable({ items: [] as Invitation[], nextCursor: null as TimelineCursor | null, loading: true, error: null as string | null, failedMore: false })
  let active = false
  let hasLoaded = false
  let request = 0
  async function load(more = false, background = false) {
    const previous = state.getSnapshot()
    if (!active || !userId || (more && (!previous.nextCursor || previous.loading))) return
    const version = ++request
    state.update({ loading: !background || !hasLoaded, error: null, failedMore: false })
    try {
      const page = await fetchInvitations(client, more ? previous.nextCursor! : undefined)
      if (!active || request !== version) return
      hasLoaded = true
      state.update({ items: [...new Map([...(more ? previous.items : []), ...page.items].map((row) => [row.id, row])).values()], nextCursor: page.nextCursor, loading: false })
    } catch (error) {
      if (active && request === version) state.update({ error: serviceError(error).message, loading: false, failedMore: more })
    }
  }
  return { ...state, load,
    start() { active = true; void load() },
    stop() { active = false; ++request },
    refresh: () => load(false, true),
    updateInvitation(row: Invitation) {
      ++request
      state.update((old) => ({ ...old, loading: false, items: old.items.map((item) => item.id === row.id ? { ...item, ...row } : item) }))
    },
  }
}
