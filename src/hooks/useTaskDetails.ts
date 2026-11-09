import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../lib/supabase'
import { createDetailStore } from '../state/detailStore'

export function useTaskDetails(client: AppClient | null, userId: string | undefined, taskId: string | null, revision?: string) {
  const store = useMemo(() => createDetailStore(client, userId, taskId), [client, userId, taskId])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  useEffect(() => { store.invalidateActivity(revision) }, [store, revision])
  return {
    ...state,
    reloadComments: () => store.loadComments(), loadMoreComments: () => store.loadComments(true),
    reloadActivity: () => store.loadActivity(), loadMoreActivity: () => store.loadActivity(true),
    setCommentDraft: store.setCommentDraft, postComment: store.postComment,
  }
}
