import { createClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import type { Database } from '../../../shared/types/database'
import { makeProfile } from '../../../test/fixtures'
import { saveProfile, validateProfile } from './profiles'

describe('account profiles', () => {
  it('normalizes usernames and accepts the database username grammar', () => {
    expect(validateProfile({ username: ' 123_ALEX ', display_name: ' Alex ', avatar_color: null })).toEqual({ username: '123_alex', display_name: 'Alex', avatar_color: null })
    expect(() => validateProfile({ username: 'bad name', display_name: 'Alex', avatar_color: null })).toThrow('Username')
  })
  it('updates only the caller profile fields and reports a duplicate username', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ code: '23505', message: 'duplicate' }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { global: { fetch }, auth: { persistSession: false, autoRefreshToken: false } })
    const profile = makeProfile()
    await expect(saveProfile(client, profile.id, { username: ' ALEX ', display_name: 'Alex', avatar_color: null })).rejects.toThrow('already taken')
    const [url, request] = fetch.mock.calls[0]
    expect(new URL(String(url)).searchParams.get('id')).toBe('eq.user-1')
    expect(JSON.parse(String(request?.body))).toEqual({ username: 'alex', display_name: 'Alex', avatar_color: null })
    expect(request?.method).toBe('PATCH')
  })
})
