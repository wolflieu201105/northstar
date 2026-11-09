import type { LiveArea, Refresh } from '../types'

/** Coalesce transaction bursts, then run at most one refresh per resource at a time. */
export function createRefreshQueue() {
  type Job = { area: LiveArea; groupId?: string; refresh: Refresh; running: boolean; again: boolean }
  const jobs = new Set<Job>()
  const pending = new Set<Job>()
  let active = false
  let timer: ReturnType<typeof setTimeout> | undefined
  function schedule() {
    if (!active || timer || !pending.size) return
    timer = setTimeout(() => {
      timer = undefined
      for (const job of [...pending]) {
        pending.delete(job)
        if (!jobs.has(job)) continue
        if (job.running) { job.again = true; continue }
        job.running = true
        Promise.resolve().then(() => { if (active && jobs.has(job)) return job.refresh() })
          .catch(() => { /* Each resource retains its own error and retry UI. */ })
          .finally(() => {
            job.running = false
            if (active && jobs.has(job) && job.again) { job.again = false; pending.add(job); schedule() }
          })
      }
    }, 120)
  }
  function register(area: LiveArea, refresh: Refresh, groupId?: string) {
    const job = { area, refresh, groupId, running: false, again: false }
    jobs.add(job)
    return job
  }
  return {
    start() { active = true; schedule() },
    stop() { active = false; clearTimeout(timer); timer = undefined; pending.clear(); for (const job of jobs) job.again = false },
    register(area: LiveArea, refresh: Refresh, groupId?: string) {
      const job = register(area, refresh, groupId)
      return () => { jobs.delete(job); pending.delete(job) }
    },
    invalidate(areas?: readonly LiveArea[], groupId?: string) {
      if (!active) return
      for (const job of jobs) {
        if (areas && !areas.includes(job.area)) continue
        if (groupId && job.groupId && groupId !== job.groupId) continue
        if (job.running) job.again = true
        else pending.add(job)
      }
      schedule()
    },
  }
}
