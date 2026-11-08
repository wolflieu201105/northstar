# Database enhancement upgrade — Phase 2

This checkpoint prepares the data model for [path-updates.md](../path-updates.md). The SQL has been tested with local synthetic data and is staged for review. Phase 3 will add the new guest policies/grants, atomic task-save RPC, and trusted activity capture before the enhancements are connected to the app.

## Files and installation paths

| File | Purpose |
| --- | --- |
| [`supabase/schema.sql`](../supabase/schema.sql) | Full schema for a clean installation at the current checkpoint: existing tasks/auth integration plus the enhancement data model. |
| [`20261108193633_add_workspace_enhancements.sql`](../supabase/migrations/20261108193633_add_workspace_enhancements.sql) | Additive upgrade for a project that already has the original Northstar `tasks` schema. Generated using Supabase CLI 3.0.0. |
| [`supabase/preflight.sql`](../supabase/preflight.sql) | Read-only inspection of the intended hosted project before applying the upgrade. |
| [`supabase/tests/`](../supabase/tests/) | Local-only fixtures, SQL assertions, catalog comparison, and PowerShell runner. Never apply test fixtures to a hosted project. |

The migration only adds a composite unique key to `tasks`; it performs no UPDATE or DELETE against existing tasks and creates no seeded application records. Existing task IDs, owners, creation/update timestamps, and field values remain intact.

The full schema and migration contain the same enhancement SQL block. Both are transactional. The local suite checks that fresh installation, upgrade, and repeating the same checkpoint's SQL produce equivalent application catalogs and preserve the sentinel task values.

This project started with manual SQL setup and does not yet have a complete historical Supabase migration baseline. Use the documented clean-install/upgrade path rather than blindly running a migration reset or pushing this additive migration against an empty database. Record which upgrade version was applied; reconcile remote migration history before adopting a full CLI deployment workflow.

## What the model adds

- `team_members`: guest-owned profiles, optional avatar color, archive/restore fields, and timestamps.
- `task_assignees`: multiple member links per task with duplicate prevention.
- `labels`: guest-owned names/colors with case-insensitive per-owner uniqueness, including archived labels.
- `task_labels`: multiple label links per task with duplicate prevention.
- `comments`: validated plain-text task comments with server-default timestamps.
- `task_activity`: validated event records and object payloads, ready for trusted event writers in Phase 3.

All child relationships include both the owner ID and parent ID in their foreign keys. Knowing another task/member/label ID is insufficient to create a valid cross-owner relationship. This is enforced by database constraints in addition to the access policies added in Phase 3.

Approved colors are `#20895b`, `#166b45`, `#4f8065`, `#505a54`, `#c9892d`, and `#c85058`. Null member colors use a future UI fallback; labels default to `#20895b`.

Members allow duplicate names because identity is their UUID. Labels reserve normalized names after archival, so an existing archived label should be restored instead of duplicated.

## Intermediate access state

RLS is enabled on all new tables and privileges are explicitly revoked from PUBLIC, `anon`, and `authenticated`. This is intentional for the Phase 2 checkpoint: none of the new features has a public data surface before its owner policies and supported column grants exist.

The existing task table keeps its original grants/policies. The current frontend still uses only that table. New features should be enabled only after Phase 3 finishes and real guest-client access checks pass.

New trigger helpers live in the non-exposed `private` schema, use `SECURITY INVOKER`, have an empty `search_path`, and cannot be called directly by API roles. They:

- Preserve member/label identity, ownership, and creation timestamps on updates.
- Set member/label `updated_at` in the database.
- Reject in-place updates to link, comment, and activity rows.
- Check and lock active members/labels when new links are inserted, including against concurrent archival.

Archiving keeps existing links. Removing an archived link is allowed once Phase 3 grants the supported deletion operation. New links to archived records fail. The UI will archive rather than hard-delete members/labels; privileged maintenance deletion can cascade their links. Task deletion cascades its links/comments/history while leaving reusable members/labels available.

No activity capture is installed in Phase 2. Existing tasks will show a history baseline message when the detail view is implemented, rather than fictitious historical events.

## Before a hosted upgrade

1. Confirm the intended project reference matches the project's `.env.local` URL without printing or sharing its credentials.
2. Run `supabase/preflight.sql` in that project's SQL Editor and compare the task schema to the original baseline. Review any unexpected tables, constraints, policies, grants, or private helpers before applying new SQL.
3. Make a backup/export using the project's available backup tooling. For logical exports, capture application schema and task data with their original IDs, owner IDs, and timestamps. Store exports outside Git and the web-served directory.
4. Verify the backup can be restored in an isolated test project. Task ownership references Supabase Auth identities; a task CSV alone does not recover lost anonymous identities or browser sessions. Plan recovery with the matching identity data and supported project restore procedure.
5. Record the pre-upgrade task count and a secure data comparison/checksum if needed. Keep real task content and tokens out of public logs.
6. Review both the Phase 2 migration and the forthcoming Phase 3 access/mutation SQL together before enabling enhanced UI features.

The hosted project was inspected read-only during this checkpoint and matched the checked-in pre-enhancement schema. No hosted migration or application-data mutation was executed.

## Applying after review

For an existing Northstar project, apply the additive migration once through the chosen reviewed migration workflow. For a new project, apply the full schema instead. Do not apply the local Auth bootstrap or synthetic test files to either project.

After applying, check that the existing task count/values are preserved and that all new tables have RLS enabled. Complete Phase 3's policies, RPC, trusted history capture, and guest-client isolation tests before using the enhancement tables from the browser.

If a statement in a SQL Editor transaction fails, roll back that transaction before retrying a corrected script. After a committed upgrade, prefer a forward correction while retaining data. The old frontend can continue using the original task columns; rolling it back does not require deleting the new tables.

Do not drop enhancement tables as a routine recovery step after members, labels, comments, or history have been saved. A destructive database rollback requires a reviewed backup and recovery plan.

## Local schema verification

The Phase 2 suite uses a dedicated PostgreSQL 17 cluster under `.tmp/phase2-postgres`, listening only on `127.0.0.1:55432`. It rejects any server whose data directory does not match that dedicated path, and accepts no remote connection string or hosted credentials.

With PostgreSQL binaries available, initialize that directory once. For the installed Windows PostgreSQL 17 location:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\initdb.exe' -D '.tmp\phase2-postgres' -U postgres --auth=trust --encoding=UTF8 --no-locale
```

This local test cluster uses trust authentication; keep it bound to loopback, use it only for synthetic data, and stop it after the check.

Start, run, and stop from the repository root:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D '.tmp\phase2-postgres' -l '.tmp\phase2-postgres.log' -o '-h 127.0.0.1 -p 55432' -t 15 -w start
& .\supabase\tests\run-schema-tests.ps1
& 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -D '.tmp\phase2-postgres' -m fast -t 15 -w stop
```

The runner creates randomly named fresh/upgrade databases on that local cluster, removes only those databases when finished, and compares columns, constraints, indexes, grants, RLS, functions, and triggers. Assertions run inside a transaction that is rolled back.

Verified results on November 8, 2026, using PostgreSQL 17.5:

- Fresh install: 45 assertions passed, including repeat application.
- Upgrade from the original schema with existing tasks: 45 assertions passed, including repeat application.
- Fresh and upgrade catalogs matched exactly for the inspected application objects.
- Existing task values/timestamps were preserved; no synthetic app records or fake activity were introduced by the migration.
- Cross-owner links, duplicates, invalid input, archived assignments/tags, protected updates, task cascades, and auth-user cascades behaved as specified.

These are PostgreSQL structure/constraint tests with a minimal local Auth fixture. They do not simulate real Supabase sign-in, JWT validation, PostgREST behavior, or final guest permissions; those checks belong to Phases 3 and 11. Supabase advisors against the new objects also remain pending because the SQL has not been applied to a Supabase test project.

## References

- [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Data API grants and RLS](https://supabase.com/docs/guides/api/securing-your-api)
- [PostgreSQL composite foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html)
