# Shared-group SQL setup — Phases 12–13

The user approved discarding the old application database on November 9, 2026. The complete group backend was prepared and tested locally; the user subsequently reported its verification passed. The agent did not run the hosted reset.

**The existing group backend is verified.** Phase 17 adds a [separate additive Realtime migration](realtime.md); run that migration and its verifier for live updates. Do not rerun the reset. Native [Auth configuration](accounts-and-groups.md) stays the same.

## Your current project

The user confirmed the complete backend verification passed. The following is the original install/reset procedure, only for an intentional new installation or destructive reset:

1. Open the intended Supabase project's **SQL Editor** and create a new query.
2. Paste the **entire** [reset.sql](../supabase/reset.sql), including `begin;` and `commit;`, and run it once. It deletes Northstar application data and installs the foundation, Phase 13 APIs, and Phase 17 live-update support in one transaction.
3. In a separate query, paste and run [verify-phase13.sql](../supabase/verify-phase13.sql) and [verify-phase17.sql](../supabase/verify-phase17.sql). Both are read-only.
4. Keep your existing project URL and public key in `.env.local` when using the same project. Configure native Auth using the [account guide](accounts-and-groups.md).

You do not need to delete tables manually or run individual migration files after `reset.sql`. Never run the test fixtures in the hosted SQL Editor. Running the reset again deletes new group data too.

The reset removes old tasks, labels, comments, history, dummy members, assignments, and obsolete Northstar functions/policies. It also handles a deliberate later reset of the shared model. It keeps Supabase Auth accounts/credentials and unrelated schemas/tables, then gives each actual Auth user a new profile, unique username, private group, and active owner membership. No users are invented from old names.

## Other starting points

Choose exactly the installer matching the database:

| Starting point | SQL to run |
| --- | --- |
| Verified Phase 13 project, retaining current work | Only the [Phase 17 additive migration and verifier](realtime.md). |
| Deliberately discard all application data | [reset.sql](../supabase/reset.sql), then the Phase 13 and Phase 17 verifiers. |
| New/empty application schema | [schema.sql](../supabase/schema.sql), then the Phase 13 and Phase 17 verifiers. |
| Phase 12 foundation already installed and its new data should remain | [20261109075450_secure_shared_group_operations.sql](../supabase/migrations/20261109075450_secure_shared_group_operations.sql), then the [Phase 17 migration](realtime.md) and both verifiers. |

Do not run the clean schema over existing tables, or run both complete installers. The [Phase 12 foundation migration](../supabase/migrations/20261109072133_add_shared_group_foundation.sql) remains a source/checkpoint file; the complete reset is only for an intentional destructive installation. Retired private-schema migrations are not required and are no longer present.

## Expected verification

The first result has ten rows:

- RLS and authenticated SELECT are true on all ten tables.
- Direct INSERT and DELETE are false everywhere.
- Direct UPDATE is true only for profiles, restricted to the three editable columns.
- Unauthenticated access is false. Profiles have two policies; other tables one each.

The RPC result has 15 invoker functions, with authenticated execution true and unauthenticated execution false. The low-level private helper result has no client/unauthenticated execution. Invalid group owners should be zero. Auth/profile counts should match immediately after setup. Editable profile columns are `avatar_color`, `display_name`, and `username`.

SQL Editor runs with administrative access; seeing rows there does not prove ordinary users can read them. Real JWT/Data API and multi-browser verification remain later checks. See [the security/API contract](group-security.md).

## Implemented database behavior

The model contains profiles, groups, memberships, invitations, tasks, labels, actual-user assignments, task-label links, comments, and activity. Same-group foreign keys prevent foreign relationships; an assignment requires active membership; pending invitations create no membership. Current active members share task editing and invitation powers. The current owner controls ownership transfer, other-member removal, and group deletion.

Task saves, relationships, exact conflict tokens, and generated history are transactional. Guest registration keeps the same UUID and work created in this model. Deleting a non-owner account keeps shared content and saved author names, while deleting a group/task cascades its children. No old board data is backfilled.

## Files, validation, and editing

The SQL modules under `supabase/sql/groups/` keep access checks, activity, group/invitation operations, task operations, and public API/policies separate. Run `supabase/scripts/build-schema.ps1` after editing them; it generates the complete schema, reset, and Phase 13 migration without running SQL.

PostgreSQL 17 passed 76 access/mutation checks on each installation path, all 39 foundation checks, three two-connection race checks, and fresh/reset catalog parity. A full reset after shared operations and reapplying Phase 13 also passed. The local CLI advisor scan reported no issues. Tests use disposable databases with synthetic claims; the cluster was stopped and databases removed. The database phase made no agent-hosted writes. The frontend is now integrated through Phase 16; native Auth settings and live multi-browser verification remain user checks.

The [old database upgrade guide](database-upgrade.md), `preflight.sql`, `verify-phase3.sql`, and root private-schema test files are historical references, not the current install instructions. [verify-phase12.sql](../supabase/verify-phase12.sql) describes the earlier closed-foundation checkpoint; use the Phase 13 verifier after the complete backend is installed.
