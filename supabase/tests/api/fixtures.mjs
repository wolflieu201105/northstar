import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { allowed, check } from './checks.mjs'

/** Creates only native anonymous Auth accounts. Tokens stay in memory. */
export async function createFixtures() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  const project = process.argv[process.argv.indexOf('--project') + 1]
  const parsed = new URL(url)
  if (!process.argv.includes('--project') || parsed.hostname !== `${project}.supabase.co` || !key) {
    throw new Error('Supply public Supabase env values and --project matching the intended hosted project.')
  }
  const runId = randomUUID()
  const records = { runId, project, createdAt: new Date().toISOString(), accounts: [], groups: [] }
  const directory = new URL('../../../.tmp/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const manifest = new URL(`phase18-${runId}.json`, directory)
  const persist = () => writeFile(manifest, JSON.stringify(records, null, 2))
  const newClient = () => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(60_000) }) },
  })
  const clients = []
  const accounts = []
  await persist()
  return {
    runId, records, accounts, clients,
    async guest(name) {
      const client = newClient()
      clients.push(client)
      const data = await allowed(client.auth.signInAnonymously({ options: { data: { northstar_test_run: runId } } }), `create guest ${name}`)
      check(Boolean(data.user?.id && data.session), `${name}: native Auth identity`)
      records.accounts.push({ id: data.user.id, name })
      await persist()
      const account = { client, id: data.user.id, name }
      accounts.push(account)
      const seededGroups = await allowed(client.from('groups').select('id').eq('owner_user_id', account.id), `track ${name} initial workspace`)
      for (const group of seededGroups) records.groups.push({ id: group.id, deleted: false, seeded: true })
      await persist()
      await allowed(client.from('profiles').update({ display_name: `Phase18 ${name}` }).eq('id', account.id).select('id').single(), `name ${name}`)
      return account
    },
    anonymous() { const client = newClient(); clients.push(client); return client },
    async group(owner, suffix) {
      const id = randomUUID()
      records.groups.push({ id, deleted: false })
      await persist()
      await allowed(owner.client.rpc('create_group', { p_group_id: id, p_name: `Phase18 ${runId.slice(0,8)} ${suffix}` }), `create ${suffix}`)
      return id
    },
    async cleanup() {
      let pending = 0
      for (const group of records.groups) {
        let removed = false
        for (const account of accounts) {
          const { error } = await account.client.rpc('delete_group', { p_group_id: group.id })
          if (!error) { removed = true; break }
        }
        group.deleted = removed
        if (!removed) ++pending
      }
      for (const client of clients) {
        await client.removeAllChannels()
        // Local scope avoids invalidating any other user's session.
        await client.auth.signOut({ scope: 'local' })
      }
      await persist()
      // Supabase documents SQL cleanup for anonymous Auth users. Guard every ID
      // with this run's metadata and refuse deletion while a fixture owns a group.
      const ids = records.accounts.map(({ id }) => `'${id}'::uuid`).join(',')
      if (ids) await writeFile(new URL(`phase18-${runId}.cleanup.sql`, directory), `begin;
do $$ begin
  if exists(select 1 from public.groups where owner_user_id in (${ids})) then
    raise exception 'Remove test-owned groups before deleting fixture accounts.';
  end if;
end $$;
with deleted as (
  delete from auth.users where id in (${ids}) and is_anonymous is true
    and raw_user_meta_data->>'northstar_test_run'='${runId}' returning id
) select count(*) as deleted_fixture_accounts from deleted;
commit;
`)
      console.log(`Fixture manifest: .tmp/phase18-${runId}.json`)
      console.log(`Auth cleanup SQL: .tmp/phase18-${runId}.cleanup.sql`)
      if (pending) throw new Error(`${pending} fixture groups need cleanup; see manifest.`)
    },
  }
}
