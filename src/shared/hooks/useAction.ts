import { useRef, useState } from 'react'

/** Keep forms editable after failures and prevent duplicate submissions. */
export function useAction() {
  const locked = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  async function run(operation: () => Promise<string | void>) {
    if (locked.current) return false
    locked.current = true
    setBusy(true); setError(null); setMessage('')
    try { setMessage(await operation() ?? ''); return true }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The request failed. Try again.'); return false }
    finally { locked.current = false; setBusy(false) }
  }
  return { busy, error, message, run }
}
