# Workspace access and atomic mutations — Phase 3

Apply the Phase 3 migration after the Phase 2 workspace migration. This checkpoint adds the database contract for the later frontend work; it does not add Team, Labels, Comments, or Activity screens yet.

## Apply to the existing Supabase project

The Phase 2 tables were confirmed present through read-only project inspection. The next SQL file is:

[`20261108195255_secure_workspace_mutations.sql`](../supabase/migrations/20261108195255_secure_workspace_mutations.sql)

In the intended project's SQL Editor, open a new query, paste that entire file including `begin;` and `commit;`, and run it once. The migration installs policies, grants, functions, and triggers, then notifies PostgREST to reload its schema when the transaction commits. Existing tasks are not updated or backfilled.

Then run [`supabase/verify-phase3.sql`](../supabase/verify-phase3.sql) for a read-only installation check. Expect all six tables to have RLS and guest SELECT enabled, unauthenticated SELECT disabled, `save_task` callable only by authenticated guests, private activity capture callable by neither API role, and all three history-write flags to be false. Member/label/link tables have three policies each, comments two, and activity one. Real guest-client checks are still separate.

New installations use the full [`supabase/schema.sql`](../supabase/schema.sql), which includes both enhancement checkpoints. Keep the pre-upgrade backup/recovery procedure in [database-upgrade.md](database-upgrade.md).

Phase 3 has been tested on isolated PostgreSQL databases. It has not been applied to the hosted project by the implementation agent. Real Supabase JWT/Data API tests and post-application advisor results remain pending.

## Access contract

| Object | Authenticated guest access |
| --- | --- |
| Tasks | Existing owner-only CRUD; insertion can also supply a stable UUID. Protected columns cannot be updated. |
| Members | Read own records; insert ID/name/color; update name/color/archive state. No guest DELETE. |
| Labels | Read own records; insert ID/name/color; update name/color/archive state. No guest DELETE. |
| Assignee/label links | Read, insert, and delete owned links. Composite foreign keys require both parents to have the same owner. |
| Comments | Read and insert on owned tasks. Stable IDs support reconciling an uncertain create response. No edit/delete or caller-supplied timestamp. |
| Activity | Read owned events. No guest INSERT, UPDATE, DELETE, or direct activity-writer execution. |
| `save_task` RPC | Execute as the current guest, with caller grants and RLS still active. |

Unauthenticated `anon` clients have no new-table or RPC access. An authenticated database role without a user identity also receives no owned rows and cannot use `save_task`.

RLS uses `(select auth.uid()) = user_id`, with both USING and WITH CHECK for editable records. Child-table ownership is also enforced by the composite foreign keys; a permitted child owner cannot reference another owner's task, member, or label. Authorization does not use user-editable metadata.

## Atomic task save

Function: `public.save_task(uuid, jsonb, uuid[], uuid[], timestamptz)`

| Argument | Behavior |
| --- | --- |
| `p_task_id` | Existing task ID, or a stable client-generated UUID for creation. Omitting it generates a UUID in the database. |
| `p_changes` | JSON object containing only changed `title`, `description`, `status`, `priority`, and/or `due_date`. A new task requires a nonblank title. |
| `p_assignee_ids` | Omitted/null preserves existing links. `[]` clears them. Otherwise replaces the set. Duplicate IDs are normalized and null elements are rejected. |
| `p_label_ids` | Same semantics as assignees. |
| `p_expected_updated_at` | Required when the task already exists. Pass the exact saved `updated_at` string. A different token fails instead of overwriting a newer change. |

The owner and activity actor come from the authenticated session. Caller-supplied owner, actor, timestamps, IDs inside `p_changes`, or activity payloads are rejected. Description/due date can explicitly be null; due-date strings must be ISO calendar dates (`YYYY-MM-DD`). Table constraints enforce field limits and valid statuses/priorities.

The result is a task row as JSON plus `assignees` and `labels` arrays containing the full related member/label rows. This is the canonical task view model for Phase 4. Arrays are deterministic by name and ID and include already-linked archived records.

Example frontend call contract for the later service implementation:

```ts
const { data, error } = await supabase.rpc('save_task', {
  p_task_id: task.id,
  p_changes: { status: 'in_progress' },
  p_assignee_ids: selectedMemberIds,
  p_label_ids: selectedLabelIds,
  p_expected_updated_at: task.updated_at,
})
```

Keep the server's timestamp string intact. Converting it through JavaScript `Date` loses sub-millisecond precision and can cause false edit conflicts. SQLSTATE `40001` means reload the current task and reconcile the retained draft before retrying.

For creation, generate and retain a stable task UUID before sending the request. If the response is lost, read that owned task ID to determine whether creation committed. Reusing an already-created ID without its expected timestamp does not overwrite the existing row. Do not blindly retry with a different ID.

The function locks the task first, then validates and locks selected member/label records. Existing archived links may remain, but archived records cannot be newly attached. Relationship inserts take locks in the same order, and only actual set differences are written.

Field changes, relation removals/additions, timestamps, and generated history share one database transaction. An error in any stage aborts all earlier writes in that call. The function itself does not COMMIT; PostgREST completes the enclosing transaction before accepting a successful response.

Frontend service migration to this function belongs to Phase 4. The existing frontend's direct task create/edit/status operations remain permitted and are already covered by the new activity triggers.

## Trusted history capture

`private.capture_task_activity()` is the only new privileged application writer. It is a trigger function, not a public RPC: API roles cannot execute it directly, it accepts no caller event arguments, and it has an empty search path with fully qualified data references.

It validates its bound source table/event and checks the authenticated actor against the source owner. It appends events for:

- Task creation.
- Status changes, with old/new values.
- Title, description, priority, and due-date edits, with actual old/new values.
- Assignee additions/removals, with member ID/name/color snapshots.
- Label additions/removals, with label ID/name/color snapshots.

Field edits are grouped into one `task_edited` payload; a status change is a separate event. Payloads include `version: 1`. Member/label renames do not alter prior name snapshots.

No-op RPC saves do not change the task token or append events. Relationship-only changes advance the task token but do not create a fictitious field-edit event. A direct timestamp-only touch likewise emits no edit event. Activity uses actual write timestamps rather than the transaction start, so waiting on a lock does not backdate its events. Use `created_at` plus ID as the stable timeline sort.

Deleting a task removes its history with its children. Trigger capture explicitly tolerates missing parents and deleted auth owners during cascades. There is no retained task-deleted event because this version does not retain history after task deletion.

Normal task/relationship mutations require a matching guest identity. Privileged manual edits in SQL Editor do not automatically impersonate a guest; maintenance that changes task data needs an explicitly reviewed actor/context procedure. Schema migrations perform no task-data mutations.

## Advisor review

The existing hosted project was inspected before writing this migration:

- Six RLS-without-policy information notices match Phase 2's intentional closed access state. Phase 3 supplies the policies; the hosted results must be checked again after application. [Advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- `public.rls_auto_enable()` is an existing SECURITY DEFINER **event-trigger** helper used by `ensure_rls`. Its definition and return type were inspected. The migration conditionally removes PUBLIC/anon/authenticated execution grants only when that exact zero-argument event-trigger function exists. The helper and event trigger retain their behavior. [Public execution advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [signed-in execution advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Anonymous-auth policy notices are expected for this guest-first application; every policy still requires an owner ID match. No public-read policy was added. [Guest access advisor](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).
- The password-protection notice concerns an Auth capability the anonymous-only app does not use. No password settings were changed. [Password protection documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Four new relationship/timeline indexes are reported unused because their features have no traffic yet. They support foreign keys and planned queries, so they are retained. [Unused index advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

These are reviewed baseline findings, not a clean post-migration hosted-advisor report.

## Verification results

Run the dedicated local cluster and `supabase/tests/run-schema-tests.ps1` using the procedure in [database-upgrade.md](database-upgrade.md).

Both clean installation and upgrade passed:

- 45 schema/constraint checks, including data preservation and cascades.
- 61 role/access/mutation checks using native PostgreSQL roles and synthetic identity claims.
- Catalog parity for tables, columns, constraints, indexes, policies, grants, functions, and triggers.
- Repeat application with existing task values preserved.

The mutation suite includes a synthetic trigger failure after fields and relationships have begun changing. It confirms complete rollback of the task, timestamp, relationship sets, and all activity generated earlier in the failed call. It also covers no-identity access, cross-owner requests, protected columns, stale tokens, archived links, snapshots, direct-write capture, history forgery, and auth-user cleanup without a guest claim.

The local fixture does not validate Supabase-issued JWTs or the actual HTTP Data API. After hosted application, still verify two real guest sessions against member/label/comment reads, direct cross-owner writes, the RPC, activity restrictions, and refresh persistence; then rerun Supabase advisors before marking Phase 3 fully verified.
