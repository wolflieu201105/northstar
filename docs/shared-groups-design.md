# Accounts and shared groups — Phase 11 design

This is the next product contract for [the enhancement roadmap](../path-updates.md). It replaces the private-workspace assumptions from the Phase 1 design for future work. Phases 1–10 remain the private-frontend baseline. Phases 12–13 now provide the locally tested group database, authorization, invitation operations, and task APIs. Account and shared-group UI follow in Phases 14–17.

## Confirmed direction

On November 9, 2026, the user confirmed:

- Email/password login and registration, with a globally unique username for invitations.
- Guests also have a unique username and a copyable account ID.
- Every active group member can work on all group tasks and invite other users.
- Group deletion and ownership transfer belong to the current owner, initially the creator. Ownership is an administrative safeguard, not a task-manager role.

**Fresh-start correction:** The user subsequently confirmed that the old application database can be discarded. Reset old tasks, labels, comments, activity, and placeholder members; no legacy backfill or placeholder preservation is required. Same-identity guest registration still preserves work created under the new schema. See the [Phase 12 SQL/reset guide](shared-groups-migration.md).

The main workflow is **create group → invite an existing account or guest → recipient accepts → collaborate and assign tasks to actual members**. Users can join multiple groups and switch between their boards.

## Identity and registration

Supabase already creates an `auth.users` record for an anonymous guest. The app restores its persisted browser session through `auth.getSession()`; this is unrelated to a Google login or the cached JavaScript build. Clearing browser data or changing browser profiles loses that guest session. See [Supabase anonymous identities](https://supabase.com/docs/guides/auth/auth-anonymous).

Use Supabase Auth for credentials and sessions. Add `public.profiles` for application identity rather than storing passwords or duplicating the Auth user table. Profile IDs equal `auth.users.id`; email remains in Auth and is not returned in group/member lookup responses. This follows [Supabase's application-profile pattern](https://supabase.com/docs/guides/auth/managing-user-data).

| Profile field | Contract |
| --- | --- |
| `id` | Existing Auth UUID; also the copyable account ID for guest invitations. |
| `username` | Globally unique, normalized lowercase, 3–30 ASCII letters/digits/underscores. Uniqueness enforced in Postgres, including concurrent claims. |
| `display_name` | Human-readable name, 1–80 characters; duplicates allowed. Invitations by name use the unique username, never an ambiguous display name. |
| `avatar_color` | Existing approved palette, optional. |
| `created_at`, `updated_at` | Database-managed. |

Generate collision-checked guest usernames at profile initialization, such as `guest_` plus a random suffix within the length limit. Let guests choose an available username in Account. Invitations resolve usernames to an immutable user UUID when sent, so later renames cannot redirect an invitation.

### Keep the current guest when registering

Upgrade the signed-in guest's existing Auth identity; do not call a fresh signup and move data based on a user-supplied old ID. The guest's UUID, profile, groups, invitations, tasks, comments, and activity must survive unchanged.

The [documented anonymous conversion flow](https://supabase.com/docs/guides/auth/auth-anonymous#convert-an-anonymous-user-to-a-permanent-user) enables manual identity linking, attaches an email with `updateUser`, verifies it through Supabase, and then sets a password. Use that built-in confirmation flow; do not build a separate email-verification service or assume disabling ordinary signup confirmation bypasses anonymous conversion requirements. Check the actual project's Auth settings and test this flow before claiming the account is registered. Email/SMTP delivery and local/production redirect URLs are setup dependencies.

Handle pending verification, resend, expired/used links or codes, interrupted conversion, and an already-used email. Never persist a plaintext password or log auth tokens. The current client has `detectSessionInUrl: false`, so explicitly implement and test confirmation/recovery completion before enabling email-link screens. A rejected or expired callback must not silently replace the guest with a new one.

Sign-in to an existing account is distinct from registering the current guest. Before switching away from a guest with work, explain that its groups will not automatically move and offer registration of that guest. Require a deliberate account switch. Automatic account merging is outside this update; neither knowing a UUID nor matching a name proves ownership of another identity.

Replace the one-time guest initializer with session state that subscribes to Auth changes and handles guest, upgrading, registered, signed-out, recovery, and error states. Create a new guest only for an intentional guest-entry flow, not during email callback handling or after every sign-out. Reset identity-scoped stores/channels on actual account changes while keeping them on same-UUID upgrades.

## Group data model

The [Phase 12 schema](../supabase/schema.sql) implements the foundation below, plus group-scoped tasks, labels, links, comments, and activity. The complete schema now includes Phase 13's membership policies and checked APIs.

| Table | Purpose and important fields |
| --- | --- |
| `profiles` | One application profile per Auth user; unique username and display metadata. |
| `groups` | `id`, `name`, `owner_user_id`, creator attribution, database timestamps. Group names need not be globally unique. |
| `group_members` | Composite key `(group_id, user_id)`, join time, inviter attribution, and active/left state. Membership is authoritative access data. |
| `group_invitations` | Stable ID, group, sender, recipient UUID, state, creation/expiry/response timestamps. Pending is not membership. |
| `task_assignments` | Real-user assignments keyed by group/task/user; references both the task's group and a membership in that same group. |

Tasks, labels, comments, activity, and task-label links gain group scope. A task belongs to exactly one group. Creator/author fields record attribution; they do not grant access independently of membership. Preserve task statuses, due dates, multiple assignees/labels, comments, and activity.

The reset removes old `team_members` and their task links. Do not import them, fabricate Auth users, or match old names to profiles. New assignments use accepted active group members through `task_assignments`.

Shared content must belong to the group for its lifetime. The new foreign keys replace the old owner-based `ON DELETE CASCADE` chains: deleting a task/group should remove its children, while leaving a group or deleting a non-owner account must not delete group tasks/comments/history. Use nullable creator/author references and retained name snapshots where necessary. Prevent owner-account deletion until its groups are transferred or deliberately deleted. Retain inactive membership references for history. Leaving/removal atomically removes that user's active task assignments and records committed removal activity; it does not delete their tasks or past comments. New assignments must validate active membership.

## Access and invitation rules

| Action | Who may perform it |
| --- | --- |
| Read a group's board, labels, comments, activity, and member directory | Active members of that group. |
| Create/edit/move/delete group tasks; manage labels; assign active members | Any active member, including guests. |
| Post comments | Any active member, with the author taken from the current session. Existing comments/activity remain append-only. |
| Send invitations | Any active member; exact account UUID or normalized username. |
| Accept/decline an invitation | Only its recipient, signed in as that UUID. |
| Revoke a pending invitation | Its sender while still a member, or the current group owner. |
| Leave a group | The current member; the owner first transfers ownership or deletes the group. |
| Remove another member; transfer ownership; delete the group | Current owner. Ownership may be transferred only to an active member. |
| Edit a profile | Its own user; members cannot rename other accounts. |

Default invitation delivery is an **in-app inbox**, which also works for guests without email. Supabase Auth confirmation email is separate from a group invitation. No invitation email delivery or OAuth login is required for this update.

Provide authenticated exact-match account lookup for inviting, returning only account ID, username, display name, and avatar color. Do not expose `auth.users`, emails, or a browsable global user directory. Scope profile reads to self, fellow group members, and narrowly defined invitation previews. Bound lookup and invitation volume in the database/trusted endpoint; a client-only debounce is not enforcement.

Accepting a pending, unexpired invitation atomically creates/reactivates one membership and resolves the request. Default expiry is seven days. Enforce one pending invitation per group/recipient, reject self-invites and existing members, and make duplicate retries safe. Re-sending after decline/revoke/expiry creates a new request. Validate active sender membership when sending and accepting; a departed sender's unresolved invites cannot admit people. Serialize accept/revoke, group deletion, ownership transfer, membership removal, and affected writes so their outcome cannot bypass access rules.

Only the intended recipient may read the minimal invitation preview before joining: group name, inviter identity, and invitation state. No tasks, comments, other group members, or internal labels are exposed before acceptance.

RLS must check current database membership for each group, not just `user_id = auth.uid()` and not membership copied into editable metadata or stale JWT claims. The clean reset removes the old owner policies and task RPC. Phase 13 introduces the new membership-based authorization. Include both `USING` and `WITH CHECK`, same-group foreign keys, protected attribution/timestamps, restricted grants, and explicit RPC checks. Private helpers need fixed search paths and narrowly reviewed privileges; public mutation APIs must not become general privileged writers.

Task save, conflict tokens, relationships, and generated activity remain transactional. Activity identifies the real actor and retains immutable historic names from the new schema. Old activity is discarded by the reset. A removed creator cannot keep editing tasks through creator IDs.

## Pages, switching, and live work

Keep the existing black–green board and feature folders. Add small `features/account/`, `features/groups/`, and `features/invitations/` modules with their own components, services, hooks/state, and colocated tests. Keep group styles in their own files.

| Surface | Behavior |
| --- | --- |
| Account / Sign in / Register | Profile, username, copyable account ID, guest upgrade, email/password login, sign-out, and native password recovery. |
| Group switcher / Groups page | Create groups; list joined groups; switch to a board; show loading, no-groups, unavailable, and retry states. |
| Members page | Actual group profiles and Invite by username/ID; no manually created member identities. Own leave and owner maintenance actions. |
| Invitations inbox | Accept/decline incoming requests; authorized sent-request status/revoke. Available independently of the active group. |
| Board / Labels / Task details | Entire feature set scoped to the selected group, with real assignees and named comment/activity authors. |

Extend query navigation with `group=<UUID>`. Group, view, task, and filter IDs are navigation hints, never access grants. Check membership before loading content. A direct task link must resolve in its declared accessible group, with a safe unavailable state for missing/inaccessible groups and old deleted-task links. Switching groups restores that group's filters/scroll, clears incompatible task overlays, and runs existing unsaved-draft guards. A copied unknown group/task link shows a generic unavailable state.

Key stores, cache entries, pagination cursors, pending mutations, and subscriptions by both authenticated identity and group. Late responses from the prior group must not populate the current board. Validate every task/member/label/comment against the selected group at the service/database boundary. Summary counts describe the active group, not every group a user belongs to.

Use Supabase Realtime for committed group changes and invitation/member updates after the scoped data layer works. Refetch authoritative rows after notifications, reconcile exact conflict tokens, preserve unsaved drafts, and unsubscribe on group/account changes. Test reconnect and removal while a task is open. Since a removed member may not receive a final membership/delete event, also revalidate on focus/reconnect, periodically while the group is open, and on authorization failures. Clear cached content after access loss; server RLS must already prevent subsequent reads/writes.

## Clean setup and release gates

1. Use the clean schema for an empty project or the explicitly destructive reset migration for the existing project. Old board data is intentionally discarded; Auth accounts are retained and provisioned with profiles and empty private groups.
2. Use Phase 13's membership-based access, group/invitation operations, protected authors, and atomic task APIs. Sensitive table writes remain closed outside the checked functions.
3. The backend may be installed using the complete reset now; the old frontend will not work against it until Auth and group-aware integration in Phases 14–16. This is an incompatible model change.
4. Verify fresh setup and populated reset locally, then test real guest and registered-user tokens, two group members, an outsider, and a removed member.
5. Verify guest registration preserves the UUID, groups, and work created in the new schema; account deletion retains other members' shared content and historic names.
6. Configure native email verification/recovery and allowed redirects during Phase 14. The connected tools do not expose hosted Auth configuration; no settings were changed or claimed verified during Phase 12.

Phase 12 passed its 39 foundation checks. Phase 13 now passes 76 access/mutation checks on each installation path, three two-connection races, reset/reapplication checks, catalog parity, and a local advisor scan. See the [security contract](group-security.md) and [SQL to run](shared-groups-migration.md). No hosted schema, Auth settings, or rows changed. The local cluster was stopped. Frontend code still targets the old backend; the prior 135-test frontend baseline does not prove new-backend compatibility.

## Official references

- [Anonymous users and permanent-account conversion](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Application profiles and Auth data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Email confirmation templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Auth state changes](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [CLI v3 migration behavior](https://supabase.com/changelog/supabase-cli-v3)

Documentation was checked on November 9, 2026. The changelog Markdown endpoint was unavailable to the tools; the official breaking-change index and relevant CLI change were reviewed instead. Re-check installed CLI help and current Auth/Realtime APIs at their implementation checkpoints.
