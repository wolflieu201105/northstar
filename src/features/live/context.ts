import { createContext } from 'react'
import type { LiveStore } from './state/liveStore'
export const LiveSyncContext = createContext<LiveStore | null>(null)
