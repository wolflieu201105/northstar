import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { AppClient } from '../../../shared/lib/supabase'
import { useLiveRefresh } from '../../live/hooks/useLiveRefresh'
import { createDetailStore } from '../state/detailStore'

export function useTaskDetails(client: AppClient | null, userId: string | undefined, taskId: string | null, revision?: string, groupId?: string, onAccessError?: () => void) {
  const store = useMemo(() => createDetailStore(client, userId, taskId, groupId, onAccessError), [client, userId, groupId, taskId, onAccessError])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useLiveRefresh('discussion', store.refresh, groupId)
  useEffect(() => { store.start(); return () => store.stop() }, [store])
  useEffect(() => { store.invalidateActivity(revision) }, [store, revision])
  return {
    ...state,
    reloadComments: () => store.loadComments(), loadMoreComments: () => store.loadComments(true),
    retryComments: store.retryComments,
    reloadActivity: () => store.loadActivity(), loadMoreActivity: () => store.loadActivity(true),
    retryActivity: store.retryActivity,
    setCommentDraft: store.setCommentDraft, postComment: store.postComment,
  }
}
