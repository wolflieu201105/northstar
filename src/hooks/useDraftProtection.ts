import { useCallback, useEffect } from 'react'
import type { NavigationGuard } from '../state/navigationStore'

export type RegisterNavigationGuard = (guard: NavigationGuard) => () => void

export function useDraftProtection(dirty: boolean, busy: boolean, registerGuard?: RegisterNavigationGuard, onNavigate?: () => void) {
  const canLeave = useCallback(() => {
    if (busy) return false
    return !dirty || window.confirm('Discard your unsaved changes?')
  }, [busy, dirty])
  useEffect(() => registerGuard?.(() => {
    if (!canLeave()) return false
    onNavigate?.()
    return true
  }), [registerGuard, canLeave, onNavigate])
  useEffect(() => {
    if (!dirty && !busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, busy])
  return canLeave
}
