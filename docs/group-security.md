# Shared-group permissions and APIs — Phase 13

The group backend is implemented and tested locally. It has not been installed on the hosted project by the agent. See [SQL setup](shared-groups-migration.md) for the complete reset, clean installation, incremental migration, and read-only verification choices. Account/group frontend work follows in Phases 14–16.

## Access boundary

Authenticated guests and registered accounts have the same permissions. Current database membership controls access; creator IDs, usernames, URL parameters, and user metadata never grant membership.

- All ten public tables have RLS and authenticated SELECT policies. A group member reads that group's tasks, labels, assignments, comments, history, and membership records.
- Profiles are readable by self and current members of a group containing that profile's active or historical membership. There is no global profile directory or email field. Only self can update username, display name, and avatar color.
- Pending recipients read their invitation record and a minimal inbox preview, not the group's board/member directory. Sent requests are readable by their sender while active, or the current owner.
- All other direct client INSERT/UPDATE/DELETE operations are denied. Task/group/invitation/comment writes use checked RPCs; discussion remains append-only.
- API-key-only `anon` clients have neither table access nor mutation execution. The signed-in anonymous guest uses the authenticated role and still needs accepted membership.

Public RPCs are `SECURITY INVOKER` wrappers. They delegate to private, fixed-search-path functions with explicit current-profile, membership, recipient, or ownership checks. This narrow privileged boundary is necessary because clients have no direct membership/history mutation grants. Each executable private entry point independently enforces its checks; putting it in a private schema is not its authorization mechanism. Low-level actor, lock, quota, task-view, provisioning, and activity-writing helpers cannot be called by clients.

## RPC contract

Arguments are named `p_*` in the SQL definitions. IDs are UUIDs and tokens are exact PostgreSQL timestamp strings. New IDs should be generated once by the client and reused during recovery.

| RPC | Contract |
| --- | --- |
| `create_group(name, group_id)` | Creates the group and active owner membership atomically; retrying an accessible existing ID returns its group without overwriting it. |
| `rename_group(group_id, name)` | Any active member may rename the group. |
| `transfer_group_ownership(group_id, user_id)` | Owner only; target must already be active. Former owner immediately loses owner-only powers. |
| `leave_group(group_id)` | Own departure; current owner must first transfer or delete. |
| `remove_group_member(group_id, user_id)` | Owner only. Clears target assignments with activity and revokes their pending outgoing requests before deactivation. |
| `delete_group(group_id)` | Owner only; cascades the group's content. |
| `lookup_invitation_target(group_id, query)` | Active member only; exact normalized username or full account UUID. Returns only ID, username, display name, and color, or null. |
| `send_group_invitation(group_id, recipient_user_id, invitation_id)` | Any active member may invite another actual account. Same request retries return its record; an existing pending request prevents duplicate sends. |
| `respond_group_invitation(invitation_id, accept)` | Recipient only. Acceptance adds/reactivates one membership; decline does not. Returns the actual resolved state. |
| `revoke_group_invitation(invitation_id)` | Active sender or current owner. Does not undo an already-accepted membership; use member removal for that. |
| `list_group_invitations(limit, before_time, before_id)` | Incoming/authorized outgoing previews, newest first. Limit 1–100, default 50; paired raw timestamp/ID cursor. |
| `save_task(group_id, task_id, changes, assignee_ids, label_ids, expected_updated_at)` | Atomic scalar/relationship save, real attribution, and generated history; returns the canonical task plus current profile/label arrays. |
| `delete_task(group_id, task_id, expected_updated_at)` | Any active member; current exact token required when the task still exists. A missing task is a safe retry. |
| `save_label(group_id, label_id, name, color, archived, expected_updated_at)` | Any active member. Existing edits require its exact token; omitted/null editable arguments preserve existing values. |
| `post_comment(group_id, task_id, body, comment_id)` | Current author/name and timestamp come from the server. An identical same-author stable-ID retry returns its original comment; different content cannot overwrite it. |

Task changes accept only `title`, `description`, `status`, `priority`, and `due_date`. Invalid types, protected fields, malformed dates, foreign IDs, null relation IDs, and new archived-label attachments are rejected. Null relation arrays preserve links; empty arrays clear; duplicate IDs normalize. Existing archived label links may remain.

Existing task/label updates require the exact saved timestamp. SQLSTATE `40001` means the record changed and the draft must be reconciled, not blindly retried. Task tokens advance monotonically with microsecond precision. No-op task saves preserve both token and history. For a lost create response, read the stable task/label ID first; an existing record cannot be overwritten as a tokenless create.

## Invitations and limits

Requests default to seven days. Only pending, unexpired requests from active senders admit the intended recipient. Expired/revoked/declined outcomes do not create membership. Retrying an accepted request after later departure/removal never reactivates membership; a new accepted request is required.

The inbox computes expired/revoked display states when a deadline passes or the sender's account/membership disappears. Resolution and subsequent sends persist the appropriate terminal state. A deleted sender cannot leave a stale pending request that blocks a new legitimate invitation.

Database-enforced fixed UTC windows allow 30 account lookups per minute and 20 newly created invitations per hour per authenticated account, across groups. Unknown lookups consume budget. Duplicate pending-request recovery does not send another request or consume another send slot. These counters are in a private, RLS-enabled, non-client-readable table; exceeding a budget raises `54000`.

## Concurrency, history, and cleanup

Group operations lock the parent group first, then operate on its task/member/invitation rows. This serializes the small group's writes, including acceptance versus revocation, edits versus removal, label archival versus attachment, and owner changes. Transactions stay short; clients reconcile conflicts/retry transient failures rather than holding long database transactions.

Task scalar changes and relation changes generate version-2 events from trigger-bound source rows. Names/colors are copied at write time, so renames do not rewrite past events. Member removal clears assignments before ending access and records the initiating member correctly. Comments are distinct from activity and are not fabricated as task-change events.

Deleting a non-owner Auth account clears its live references and assignments while retaining group-owned tasks, comment text, historic names, and activity payloads. Assignment cleanup records a null-actor `System` event with the saved assignee name. The cleanup guards validate the missing Auth parent rather than relying on trigger nesting depth, since PostgreSQL can queue cascade events. Owner deletion remains blocked until ownership/groups are handled. Group/task deletion removes their children without terminal-event failures.

## Source and artifacts

Edit the smaller SQL modules under `supabase/sql/groups/`: access helpers, activity/guards, group/invitation operations, task/label/comment operations, and API/grants/policies. Run `supabase/scripts/build-schema.ps1` to regenerate the complete SQL Editor artifacts. The script does not connect to a database.

The CLI-generated Phase 12 foundation remains the foundation source; its reset prefix now also retires Phase 13 APIs and quotas when deliberately resetting an already-shared installation. The generated Phase 13 migration is additive to that foundation and can be reapplied without clearing data. Once installed, keep applied migrations immutable; append new CLI-generated migrations and extend the builder for later database changes. The complete `reset.sql` is destructive on every run.

## Validation and remaining boundaries

November 9, 2026 validation:

- 76 access/mutation checks passed on each of the fresh and reset installation paths.
- All 39 closed-foundation checks still passed before Phase 13 was added.
- Three actual two-connection checks passed: stale task edit loses with `40001`; removal blocks a waiting edit with `42501`; revocation prevents waiting acceptance from admitting the recipient.
- Fresh/reset catalogs match, including public/private tables, constraints, indexes, grants, functions, policies, and Auth triggers. Reapplying Phase 13 and resetting after shared operations leave the expected catalog.
- Both read-only verification scripts executed successfully at their correct checkpoint.
- The Supabase CLI's local custom-Postgres advisor scan returned **No issues found**. Temporary databases were removed and the dedicated cluster stopped.

SQL tests use real PostgreSQL roles, RLS, and functions with synthetic request claims. They do not create real Supabase JWTs or prove the HTTP Data API/managed Auth conversion; those checks remain after installation and in Phases 14/18. No hosted schema/data/Auth settings or frontend code changed. Frontend tests/build were not rerun for this SQL-only checkpoint; the previous frontend is incompatible with this new backend until integration.

Read-only hosted advisors still examine the old private schema. Their anonymous-user warnings are an intentional guest-access choice, with membership/owner restrictions still required; see [the advisor explanation](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins). The baseline also flags leaked-password protection; review native password settings and plan availability during Phase 14 using [Supabase password security](https://supabase.com/docs/guides/auth/password-security). Two unused-index informational findings concern retired assignment/label indexes, not the new group schema. Re-run managed advisors after installing the new backend rather than treating old-project findings as a group-schema scan.

References checked during implementation: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), and [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html).
