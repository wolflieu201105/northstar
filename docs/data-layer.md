# Typed group data services and state — Phases 14–16

The current frontend targets the installed shared-group backend. Generated [database types](../src/shared/types/database.ts) describe profiles, groups, memberships, invitations, tasks, labels, assignments, comments, and activity. The former owner-only `user_id` task contract and `team_members` table are no longer used.

## Context and ownership

App restores/subscribes to Supabase Auth before mounting workspace state. The workspace root is keyed by Auth UUID; same-UUID guest conversion keeps that root and its work. Identity/profile/group directory state is keyed by client and UUID. Task/lookup stores additionally use group ID; detail stores additionally use task ID. Stopped reads, old pages, and old scopes do not populate the active view.

The selected group comes from joined groups and `group=<UUID>` in the URL. Unknown/inaccessible direct links never start board/detail requests. First entry without a group selects the initial joined group. Confirmed membership loss unmounts inaccessible data and clears overlays, while failed revalidation keeps drafts. Focus/manual refresh and denied mutations revalidate the group directory; automatic synchronization follows in Phase 17.

## Services

| Feature | Reads | Writes |
| --- | --- | --- |
| Account | Self profile by Auth UUID. | Direct update of username, display name, and avatar color only. |
| Groups/members | RLS-filtered groups; group memberships joined to real profiles. | Create/rename/leave/remove/transfer/delete checked group RPCs. |
| Invitations | Restricted exact lookup and paginated authorized inbox RPC. | Stable-ID send, recipient respond, authorized revoke RPCs. |
| Tasks | Group-scoped tasks with nested active membership/profile and label joins. | `save_task` / `delete_task` with `p_group_id` and exact revision tokens. |
| Labels | Group label directory including archived labels. | `save_label` with stable ID and exact existing revision token. |
| Comments | Group/task timeline, oldest first. | `post_comment` with stable ID/body; server supplies author/time. |
| Activity | Group/task timeline, oldest first. | No browser writes. Parse version 2 payloads and real actor snapshots. |

The [Phase 13 security/API contract](group-security.md) remains authoritative. Browser controls are usability checks; SQL grants, accepted membership, same-group constraints, and atomic operations enforce access.

## Saving and failure recovery

Task relation arrays are passed separately: omitted arrays preserve current links; an explicit empty array clears links. Scalar changes are whitelisted server-side. A task created by another member may be edited in a shared group; creator identity does not grant or restrict current membership.

Task/label editors keep their original raw `updated_at` string, including microseconds and timezone offset. A newer revision produces a conflict, retains the draft, and requires explicit adoption of the latest version. Deletes also use the current task revision. Optimistic status moves roll back on failure and reconcile uncertain/conflicting responses.

Task, label, comment, group, and invitation creates retain request UUIDs for retries. Uncertain task/label/comment responses are read back before treating the request as committed. A response does not manufacture activity; history comes from committed database events. Native Auth errors retain appropriate form inputs; plaintext passwords and extra token copies are not persisted.

Comments/activity use full-precision timestamp and UUID keyset cursors, 50-row pages, stable deduplication, and same-cursor retries. Invitations use their newest-first server cursor and display the actual resolved status after racing actions.

## Lookups and presentation

The `team` feature contains read-only real-account avatars/pickers. Group membership supplies active assignee choices. Profile updates refresh current lookups, updating card/filter display without rewriting historic comment/actor/assignment snapshots. Labels retain archive/restore semantics and existing links.

Board filtering and summary values are derived from canonical tasks in the active group. Per-group URL filters and in-memory scroll/filter memory survive local switching; switching Auth identity clears that memory. Navigation guards cover dirty task/comment/label/profile drafts and pending operations.

## Verification boundary

Local tests cover native Auth with mocks, actual Supabase-client HTTP request shapes, stable retries/cursors, stale scopes, guards, author rendering, shared task behavior, membership-loss composition, and prior board regressions. These checks do not prove hosted email delivery or actual JWT/RLS behavior. Follow [the manual review guide](accounts-and-groups.md); real-client multi-user security and Realtime checks remain Phases 17–18.
