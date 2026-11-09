import { useEffect, useState } from 'react'

export function useActivityClock() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const onVisibility = () => { if (document.visibilityState === 'visible') update() }
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return now
}
