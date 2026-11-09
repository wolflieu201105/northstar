# Shared live updates — Phase 17

Phase 17 adds private Supabase Broadcast invalidations, authoritative background refreshes, reconnect recovery, and periodic access checks. The frontend and SQL are implemented and tested locally. The hosted migration and actual two-browser WebSocket verification remain the review checkpoint.

## SQL to run for the existing project

Your Phase 12/13 database is already verified. Keep its accounts, groups, and work.

1. Open the project's SQL Editor and run the entire [20261109141005_add_private_workspace_realtime.sql](../supabase/migrations/20261109141005_add_private_workspace_realtime.sql).
2. Run [verify-phase17.sql](../supabase/verify-phase17.sql) in a separate query. It is read-only.
3. Open [Realtime settings](https://supabase.com/dashboard/project/eucugwxayfkqhhiesppm/realtime/settings) and disable **Allow public access** so channels require private authorization.
4. Reload the running app. The connection strip should show **Live updates** once the account and selected group channels join.

Do not run `reset.sql` or reinstall `schema.sql` over the verified database. This migration is additive and can be reapplied; it changes no application rows and adds no public RPC. No new environment variables or packages are needed.

If an earlier copy failed with `42501: must be owner of table messages`, copy the updated migration and rerun it in full. The installer now checks the existing RLS flag through the catalog instead of issuing `ALTER TABLE`. Supabase owns `realtime.messages`, already enables RLS, and permits policy DDL through its managed privileges. Do not change the table owner or try to grant the internal owner role. If SQL Editor reports an aborted transaction, run `rollback;` first. See [Supabase's explanation](https://supabase.com/kb/troubleshooting/realtime-must-be-owner-of-table-messages).

For a new empty project, the generated `schema.sql` includes Phases 12, 13, and 17. The generated reset includes all three only for an explicitly destructive reset. Applied Phase 12/13 migration files remain unchanged.

## Expected verification results

- Native Broadcast is available and `realtime.messages` has RLS.
- Four Northstar policies exist: authenticated receive, authenticated namespace restriction, anonymous namespace denial, and a namespace restriction on client sending.
- Ten application tables have the `northstar_broadcast_change` trigger.
- Three private functions have fixed search paths and no unauthenticated execution. Only `can_receive_workspace_changes` is executable by authenticated clients; the writer and trigger function are not client endpoints.
- No Northstar application table needs to appear in `supabase_realtime`. This implementation uses Broadcast, not Postgres Changes publications.

If the strip stays paused, check the migration, private-channel setting, current group membership, and browser network connection. **Retry connection** and the existing manual refresh buttons remain available. Visible online pages also reconcile every 30 seconds.

## Channel and authorization contract

| Topic | Receive permission | Signals |
| --- | --- | --- |
| `northstar:account:<Auth UUID>` | The current account, with an existing profile. | Profile, joined-group directory, and authorized inbox changes. |
| `northstar:group:<group UUID>` | Current accepted active membership in that group. | Board, labels, members, discussion, group directory, and authorized sent-invitation changes. |

Database triggers send private empty payloads with an area name. They send no task text, comments, author snapshots, or relationship IDs. Browser clients cannot broadcast to this namespace. Restrictive namespace policies prevent a separate broad permissive policy from granting outsider access; unrelated topic policies retain their behavior.

Every signal refetches canonical data through the existing RLS/RPC model. Notifications never become application rows or success events. Rolled-back changes leave no queued message. A notification delivery failure does not fail user CRUD; periodic reconciliation repairs missed hints.

Postgres Changes DELETE events cannot be filtered and do not apply row-level security like ordinary reads. The implementation therefore publishes no application tables and uses private, content-free hints for insert/update/delete.

Realtime authorization is cached at channel join and when a fresh JWT arrives. A removed client may retain a previously authorized connection briefly; that connection carries no record content. The independent account channel signals access loss, and focus/reconnect/30-second revalidation also checks the authoritative group directory. RLS independently denies new data reads/writes immediately after membership ends.

## Client recovery and draft behavior

- One account channel and one selected-group channel are shared by the feature hooks.
- A 120 ms queue combines transaction bursts. Each resource runs one refresh at a time and schedules one follow-up if another signal arrives during the read.
- Background refreshes retain the board and its scroll instead of replacing it with a loading skeleton.
- Group/account switching ignores old callbacks and awaits topic disposal before reuse, including switching between two accounts that share a group. Cleanup stops channels, queued work, listeners, and periodic timers.
- Subscribe/reconnect, browser online/focus/resume, and visible online 30-second checks refetch authoritative state. Offline pages pause automatic work.
- Remote edits retain dirty task/label/profile/group drafts. Exact task/label revision tokens still prevent stale saves; their editors require explicit review/adoption of the latest version.
- Member removal updates pickers. An unsaved selection that disappears remains visibly unavailable and removable.
- Comments/activity merge a bounded newest page with loaded history, retaining exact timestamp/UUID ordering. If an unread gap exists, Load more stays between the older prefix and recent entries. Live refresh does not erase a failed page cursor or comment draft.
- Current names/colors refresh on cards and member lists. Saved historical author/actor names remain unchanged.
- Confirmed group access loss clears inaccessible board/details and redirects to another joined group or the no-groups state, including when the old detail had a dirty draft.

## Review with two independent browsers

Use accounts A and B who have accepted membership in the same group, with that group selected in both.

1. Confirm both connection strips show **Live updates**.
2. Create/edit/move/delete tasks in A. B's cards, columns, counts, and due indicators should update without clicking Refresh.
3. Add/archive/rename labels and assign/remove accepted members. Check chips, pickers, filters, and summaries in B.
4. Open the same task in both. Post comments and make edits in A. B should receive the real author/activity names. Type a task edit and comment draft in B first; A's changes must preserve both drafts and surface a task conflict.
5. For longer history, load several pages and create more comments/events in A. Existing rows stay, recent rows appear, unread gaps remain loadable, and timestamps/IDs do not duplicate.
6. Invite an account or guest. Its incoming inbox should update. Accept/decline/revoke and check actual resolved states, joined groups, and member options.
7. Disconnect B's network, change work in A, then reconnect B. It should catch up. Exercise tab suspension/resume and **Retry connection**.
8. Remove B or delete the group while B has a dirty detail open. Its independent account hint or next visible access check must clear inaccessible content and route safely.
9. Rapidly switch groups and accounts, including two accounts sharing a group. Old messages must not populate the new scope. Check the connection strip on a narrow viewport and review keyboard controls.
10. Keep an outsider/pending invitee outside the group: knowing a topic or record ID must not reveal board content or grant a private subscription.

## Local validation and limits

On November 9, 2026, 179 frontend tests across 34 files, lint, and the production build passed. Focused tests cover private topic configuration, coalescing, in-flight follow-up, reconnect/offline/periodic recovery, StrictMode/account disposal, dirty detail composition, live comments/actors, exact cursors/gaps, late responses, and unavailable draft selections.

PostgreSQL 17 passed 32 Realtime security/transaction checks on both fresh and upgrade paths, the existing 76 access/mutation checks on each path, 39 foundation checks, and three real two-connection races. The fixture now rejects managed-table `ALTER TABLE` even for the local superuser, covering the hosted ownership restriction missed by the earlier fixture. Reapplication and full reset/catalog parity passed. A simulated notification outage intentionally prints a warning while proving user work still commits. Disposable databases were removed and the local cluster stopped.

The local advisor scan reported no warnings/errors; informational findings were unused indexes in the fresh fixture and the intentionally policy-free private quota table. This is not a hosted Auth/advisor scan.

The local queue fixture models PostgreSQL RLS and transactional messages, not Supabase's WebSocket service. Actual channel joins, delivery, two-browser timing, reconnect, and narrow-screen behavior remain manual checks after applying the SQL. Real JWT/API acceptance and final security review remain Phase 18. The agent has not applied this migration or changed hosted data/Auth/Realtime settings.

References: [Broadcast from the database](https://supabase.com/docs/guides/realtime/broadcast), [Realtime authorization and its cache](https://supabase.com/docs/guides/realtime/authorization), [Postgres Changes limitations](https://supabase.com/docs/guides/realtime/postgres-changes), and [database change subscriptions](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes).
