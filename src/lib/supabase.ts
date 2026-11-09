import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

export type AppClient = SupabaseClient<Database>

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

const isPlaceholder = (value: string | undefined) =>
  !value || value.includes('your-project') || value.includes('your_project')

export const supabaseConfigError =
  isPlaceholder(url) || isPlaceholder(publicKey)
    ? 'Supabase is not configured. Add a project URL and browser-safe publishable key to .env.local.'
    : null

export const supabase: AppClient | null = supabaseConfigError
  ? null
  : createClient<Database>(url!, publicKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
