# Database transition note

The source/services documented below still target the private-workspace database. The [new group foundation](shared-groups-migration.md) is prepared and tested locally; its APIs are implemented in Phase 13, while generated client types and frontend integration follow in Phases 14–16. Old queries/types do not describe that new schema.

# Typed data services and state — Phase 4

Phase 4 connects the installed database contract to the application data layer. The existing create/edit/drag actions now use `save_task`. New Team, Labels, and task-detail screens follow in Phase 5 and the feature-specific checkpoints.

## Database contract

`src/shared/types/database.ts` was generated from the hosted Supabase public schema after Phase 3 was confirmed installed. `AppClient` uses that schema with `createClient<Database>`.

Generated insert/update types describe database columns; they do not grant permission to write protected columns. The application services expose only supported operations, and Supabase grants/RLS remain the security boundary.

- `Task` represents scalar persisted fields with narrowed status/priority values.
- `TaskView` adds complete assignee and label records.
- `TaskChanges` adds optional `assigneeIds` and `labelIds` arrays to partial scalar changes.
- Member/label/comment domain types reuse generated rows.
- Activity is a discriminated union for version-1 events, with an explicit unknown-event fallback for future payloads.

## Services

| Module | Behavior |
| --- | --- |
| `services/tasks.ts` | One nested board query loads each task and its member/label relationships. Create/edit/status writes call the atomic RPC. Delete remains an owner-filtered table operation. |
| `services/team.ts` | Load, create, rename/recolor, and archive/restore guest-owned members. |
| `services/labels.ts` | Equivalent label operations, including readable duplicate-name feedback. |
| `services/comments.ts` | Load chronological pages and append validated comments with a stable request ID. |
| `services/activity.ts` | Read server-authored chronological activity pages. There is no client history-write operation. |
| `services/timeline.ts` | Shared timestamp/UUID cursors and a 50-row page with one lookahead row. |
| `services/errors.ts` | Preserve database error codes, distinguish uncertain responses, and provide actionable messages. |

Task write requests keep the server's full-precision timestamp string intact. Omitted relationship arrays preserve links; empty arrays clear them. RPC JSON responses are validated before becoming canonical task state.

Creation accepts a stable client UUID. After a lost response, task/comment/member/label services read that same owned ID before concluding whether creation committed. Stores keep the creation intent ID after failure so retrying does not generate a different identity for the same request.

An ambiguous update is reconciled by reading the affected task. A stale timestamp reports a conflict while preserving the form's existing local draft. There is no automatic retry that overwrites a newer task.

## State ownership

Small external stores use React's `useSyncExternalStore` so async operations and mutation locks do not depend on a stale render closure.

| Store/hook | Responsibility |
| --- | --- |
| `taskStore` / `useTasks` | Canonical persisted task views, loading/errors, synchronous per-task mutation guards, optimistic moves, rollback, reconciliation, and stable create IDs. |
| `workspaceStore` / `useWorkspaceData` | Independent parallel member and label loading, record mutation guards, and canonical lookup metadata. |
| `detailStore` / `useTaskDetails` | Task-scoped comments/activity, separate list errors/loading, pagination, retained comment drafts, posting guards, and server-history invalidation. |

Stores are created for a specific client/guest, and detail stores also bind the task ID. Switching identity or task immediately selects an empty new store; late reads from an old store cannot populate the newly selected workspace/task. Effect cleanup invalidates pending read generations.

Task and lookup reads that overlap mutations cannot replace a newer committed result with an older response. A move, edit, or deletion acquires its task lock synchronously before its request starts. Lookup metadata overlays existing task relationships, so renaming or archiving a member/label updates presentation without changing the task's assigned IDs or rewriting activity snapshots.

The existing app starts task/member/label reads after auth without creating a request per card. Selected tasks are resolved by ID from canonical state. The form's opening timestamp is retained separately as its edit token, so a later board update cannot silently turn an old draft into a write against a newer token.

Comments and history are loaded only when a caller supplies an opened task ID to `useTaskDetails`; no comment/history requests were added to the board itself. Posting preserves a newer draft if the user types while an earlier draft is saving. An older initial read cannot erase a newly confirmed comment. Rows merge by ID and sort with microsecond-aware timestamps and an ID tie-breaker.

Passing a changed task `updated_at` revision to `useTaskDetails` refetches authoritative history. History rows are never synthesized from local optimistic actions. The task-detail UI and browser navigation hook are implemented in Phase 5; the data hook is ready for that connection.

## Verification

- 29 tests pass across 7 files, including the existing form and utility tests.
- New tests cover exact RPC request bodies/timestamps using the real Supabase query builder with a mocked transport, nested board queries, lost-response reconciliation, same-task mutation blocking, stable retry IDs, identity/task switching, comment draft retention, independent history errors, lookup races, pagination cursors, unknown activity, and metadata propagation.
- ESLint passes.
- Production build/type checking passes with lazy board/form chunks retained.

The installed Phase 3 RPC and authenticated/unauthenticated execution grants were verified read-only, and hosted advisor reports were refreshed. The earlier missing-policy and publicly executable privileged-helper findings are gone. Remaining reports concern intentional guest access, unused new indexes, and the unused password-auth configuration described in `database-security.md`.

These transport tests make no hosted writes. End-to-end Supabase JWT/Data API isolation testing with two real guest clients remains in the verification plan. No new SQL or environment variables are required for Phase 4.

## Review this checkpoint

Run the existing app and check create → edit → move → refresh against your configured Supabase project. The visual board is unchanged, but those saves now pass through the new transaction and record server history. New feature controls appear in subsequent checkpoints.

For the completed comment interface and updated pagination/retry behavior, see the [Phase 8 comment guide](task-comments.md). The results above record the Phase 4 checkpoint.
