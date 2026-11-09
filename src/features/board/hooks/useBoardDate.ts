import { useEffect, useState } from 'react'

const localDay = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** One clock for the whole board, including cards and summary counts. */
export function useBoardDate() {
  const [today, setToday] = useState(localDay)
  useEffect(() => {
    let timer: number
    const schedule = () => {
      window.clearTimeout(timer)
      const day = localDay()
      const midnight = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
      timer = window.setTimeout(update, Math.max(1, midnight.getTime() - Date.now()))
    }
    const update = () => {
      const day = localDay()
      setToday((previous) => previous.getTime() === day.getTime() ? previous : day)
      schedule()
    }
    const onVisibility = () => { if (document.visibilityState === 'visible') update() }
    schedule()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return today
}
