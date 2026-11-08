import { useCallback, useEffect, useState } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

let initializationPromise: Promise<Session> | null = null

async function initializeGuestSession(client: SupabaseClient) {
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession()

  if (sessionError) throw sessionError
  if (session) return session

  const { data, error } = await client.auth.signInAnonymously()
  if (error) throw error
  if (!data.session) throw new Error('Supabase did not return a guest session.')
  return data.session
}

export function useGuestSession(client: SupabaseClient | null) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [completedAttempt, setCompletedAttempt] = useState<number | null>(client ? null : 0)
  const isLoading = Boolean(client) && completedAttempt !== attempt

  const retry = useCallback(() => {
    initializationPromise = null
    setError(null)
    setAttempt((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!client) return

    let active = true

    initializationPromise ??= initializeGuestSession(client)
    initializationPromise
      .then((nextSession) => {
        if (active) setSession(nextSession)
      })
      .catch((reason: unknown) => {
        initializationPromise = null
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Guest sign-in failed.')
          setSession(null)
        }
      })
      .finally(() => {
        if (active) setCompletedAttempt(attempt)
      })

    return () => {
      active = false
    }
  }, [attempt, client])

  return { session, isLoading, error, retry }
}
