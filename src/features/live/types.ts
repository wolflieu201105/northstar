export const LIVE_AREAS = ['board', 'members', 'labels', 'discussion', 'directory', 'profile', 'invitations'] as const
export type LiveArea = typeof LIVE_AREAS[number]
export type LiveConnection = 'connecting' | 'live' | 'paused' | 'offline'
export type Refresh = () => Promise<unknown> | void
