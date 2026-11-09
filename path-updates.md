# Task Manager Enhancements — Step-by-Step Build Plan

Extend Northstar into a task board that multiple users share through groups. Preserve the team/label, comment, activity, filter, due-date, and summary work from Phases 1–10, then add real accounts, guest upgrades, group membership, accepted invitations, and live collaboration. Check items off as they are implemented and verified; recorded completion is not a claim that later shared-group behavior already exists.

Keep [path.md](path.md) as the original build plan and [README.md](README.md) as the description of the working application. This update plan follows the same roadmap, checklist, acceptance criteria, time-budget, and reference structure.

**November 9 fresh-start correction:** The user approved discarding existing application data. Phase 12 therefore supplies a clean group schema and a destructive reset, without importing old tasks or placeholder members. Guest registration must still preserve work created afterward. No hosted reset has been performed.

**November 9 scope update:** Email/password accounts, unique invitation usernames, and shared editing/invitations for accepted members are implemented through Phases 11-16; see the [accepted collaboration design](docs/shared-groups-design.md). The user confirmed Phase 17 live updates working. Phase 18 real-client verification is in progress and found a stale-revision HTTP issue; the [additive SQL fix and results](docs/phase18-verification.md) are the current checkpoint. Registered-user, email, and full browser acceptance remain open. Release remains Phase 19. [update_path.md](update_path.md) links to the current next action.

## 1. High-level roadmap

Follow this order. Finish each phase's **Done when** check before moving on. Stop after each numbered phase unless the user explicitly authorizes a batch. The user requested Phases 14–16 consecutively; stop after Phase 16 for review. The seven original feature groups and the shared-group update are in scope; do not silently drop one to meet a time estimate.

| Phase | Main idea | Result |
| --- | --- | --- |
| 1 | Confirm the baseline and updated experience | Agree on the scope, navigation, and black–green visual structure. |
| 2 | Design the additive database upgrade | Define member, assignment, label, comment, and activity records without losing existing tasks. |
| 3 | Secure relationships and record activity | Enforce ownership, atomic saves, and database-generated history. |
| 4 | Extend types, services, and state | Provide reusable data operations that keep the board and detail view consistent. |
| 5 | Add workspace navigation and task details | Introduce Team and Labels views plus a responsive task-detail panel. |
| 6 | Build team members and multiple assignees | Manage members, assign several to a task, and display avatars. |
| 7 | Build custom labels and task tagging | Manage labels and attach several labels to a task. |
| 8 | Add persistent task comments | Write and read chronological comments with timestamps. |
| 9 | Display the task activity timeline | Show reliable creation, status, edit, assignment, and label events. |
| 10 | Complete filters, due dates, and summaries | Combine search, priority, assignee, and label filters with clear counts. |
| 11 | Define accounts and shared-group behavior | Confirm identity, collaboration permissions, invitations, and data preservation. |
| 12 | Add profiles, groups, and reset SQL | Introduce the clean group schema and intentionally discard old application data. |
| 13 | Secure group access and mutations | Enforce membership, invitation acceptance, real actors, and atomic operations. |
| 14 | Build accounts and guest registration | Sign in, register the current guest without losing its identity, and recover sessions. |
| 15 | Build groups, invitations, and members | Create/switch groups, invite by username/ID, accept requests, and manage membership. |
| 16 | Scope task features to the active group | Use real assignees, group-specific data/state, named authors, and protected switching. |
| 17 | Synchronize shared work | Reflect committed changes across users, reconcile conflicts, and revoke stale access. |
| 18 | Verify security and the complete experience | Test multi-user membership, migration safety, isolation, failures, and regressions. |
| 19 | Update documentation and release | Document the shared-group upgrade, deploy the tested version, and update submission materials. |

**Stack:** Keep React + TypeScript + Vite, Supabase JS, dnd kit React, plain CSS, Vitest, Testing Library, and the current CI workflow. Extend the existing Supabase client with native Auth and Realtime. Use database policies/RPCs for group authorization; introduce a small trusted endpoint only if an operation genuinely needs it. Keep credentials in Supabase Auth and service secrets out of Vite. No separate password store or avatar upload service is required.

**Scope:** Real users and guests can belong to multiple groups. Every active group member can work on all tasks and send invitations; membership must be accepted before access or new assignment. The current group owner controls removal of other members, group deletion, and ownership transfer. Unique usernames and account UUIDs identify invitation recipients. Guest registration preserves its Auth UUID and existing work. The old board and manually created profiles may be discarded; each retained/new Auth user starts with a real profile and an empty private group. No fabricated accounts or legacy links are imported. In-app invitations and Supabase's built-in confirmation/recovery email flows are included; group invitation emails, OAuth, and automatic merging into an already-existing account are outside this update.

### Current baseline

The following items exist in the source and should be retained and regression-tested rather than rebuilt.

| Requested feature | Current implementation | Work still needed |
| --- | --- | --- |
| Team members and assignees | Local profile CRUD, multiple assignments, and avatars implemented. | Replace manual profiles with accepted real memberships; old data may be reset. |
| Task comments | Append-only comments, chronological pagination, and retry implemented. | Group-based access and real author names for comments created in the new schema. |
| Task activity log | Database events, before/after details, relative time, and pagination implemented. | Group authorization and real actor snapshots; old stored history may be reset. |
| Labels / tags | Label management, task links/chips, and filters implemented. | Group scope and shared edits. |
| Due-date indicators | Local midnight/resume clock, DST/calendar boundaries, neutral Done dates implemented. | Retain behavior through group/account changes and live edits. |
| Search and filtering | All four groups, ANY/AND semantics, URL state, and missing-ID handling implemented. | Per-group filter state and real-member options. |
| Board summary / stats | Whole-board scope, filtered counts, and load/error states implemented. | Active-group scope with multi-user updates. |
| Identity | Persisted anonymous Supabase session; no sign-in/register UI. | Profiles, unique usernames, email/password login, and same-identity guest registration. |
| Shared groups | Not implemented; database currently enforces owner-only access. | Group schema, acceptance-based membership, invitation inbox, RLS, and live synchronization. |

Phase 10 baseline: 135 tests in 30 files, ESLint, and the TypeScript/production build passed on November 9, 2026. Its manual browser checks remain open. Earlier phase descriptions record the private-workspace implementation at that time; the Phase 11 design supersedes their future product assumptions without rewriting that history.

### How to divide the work

- Work on one numbered phase or subsection at a time.
- Keep a short note under the active phase: `Owner: ___ | Status: ___ | Next action: ___`.
- Agree on database fields, service return types, and component props before connecting UI components.
- Commit after each working milestone. Preserve unrelated local changes and the existing `.env.local` configuration.
- Review database SQL as a checkpoint before applying it to the selected Supabase project.
- Test database changes with guest clients, not only the privileged SQL Editor.
- Keep credentials and confidential assessment material out of code, documentation, test output, and screenshots.

## 2. Detailed implementation checklist

### Phase 1 — Confirm scope and visual design

Owner: Codex | Status: Complete | Next action: Design accepted for Phase 2 implementation.

Deliverable: [Enhancement design and baseline](docs/enhancement-design.md). Local lint, 12 tests, and the TypeScript/production build passed on November 8, 2026. Real-browser guest restoration, persistence, dragging, and database isolation have not been rerun in this checkpoint; the baseline report distinguishes source/test evidence from the user's earlier manual verification.

#### 1.1 Preserve the working application

- [x] Audit guest-session restoration, task CRUD, four columns, drag/drop, and persistence; record which behavior still requires live verification.
- [x] Review the existing task, draft, and insert types before extending their contracts.
- [x] Record the current lint, test, and build results as the regression baseline.
- [x] Retain the black–green palette and existing design tokens in the design. Use red/amber for urgency and errors.
- [x] Establish data preservation as an upgrade requirement; existing task data must not require dropping the `tasks` table.

#### 1.2 Define the updated user journey

- [x] Define the journey: guest opens the board, adds members, creates labels, and creates a task with multiple assignments and tags.
- [x] Specify editable task details, assignments, labels, comments, and activity when opening a task.
- [x] Specify saves that update the board, persist all related records, and record activity together.
- [x] Specify search and filters that narrow visible cards without changing saved tasks.
- [x] Specify refresh behavior that restores the guest's tasks, members, labels, comments, and history.

These checkmarks record completed design decisions. Feature implementation and live verification remain in the later phases below.

#### 1.3 Sketch navigation and layouts

| Surface | Purpose | Planned navigation |
| --- | --- | --- |
| Board | Four columns, summary, member avatar strip, filters, task cards. | `/` |
| Team | Create, rename, recolor, and archive guest-managed members. | `/?view=team` |
| Labels | Create, rename, recolor, and archive custom labels. | `/?view=labels` |
| Task detail | Edit the task and inspect its comments and activity. | `/?task=<task-id>` over the board |

- [x] Specify query-string navigation through a small shared hook so no new routing dependency or hosting rewrite is required.
- [x] Define browser Back/Forward, refresh, direct-link, and unsaved-draft behavior.
- [x] Sketch a side panel on desktop and a full-screen detail surface on mobile.
- [x] Specify preservation of active board filters and scroll position when opening and closing a task.
- [x] Choose separate Comments and Activity tabs within task details, with task fields above them.
- [x] Define empty, loading, error, and archived-item states before building the views.

**Done when:** The updated journey, management views, task detail layout, and ownership scope are clear enough to implement without redesigning the core board.

### Phase 2 — Design the additive database upgrade

Owner: Codex | Status: Complete — confirmed present in Supabase | Next action: Phase 3 implementation and verification.

Deliverables: [clean-install schema](supabase/schema.sql), `20261108193633_add_workspace_enhancements.sql` (retired), [read-only preflight](supabase/preflight.sql), and [upgrade/test guide](docs/database-upgrade.md). PostgreSQL 17.5 passed 45 assertions for each of the clean-install and upgrade paths; catalog parity and repeat application were verified. Read-only hosted inspection subsequently confirmed the Phase 2 tables are installed with RLS enabled. New guest access remains closed until Phase 3 is applied; its hosted Data API and advisor verification are still pending.

#### 2.1 Prepare a safe upgrade path

- [x] Inspect the existing project tables, constraints, grants, policies, functions, and triggers before changing them.
- [x] Keep the existing task IDs, owners, timestamps, statuses, priorities, descriptions, and due dates.
- [x] Check the available Supabase CLI version and command help before using migration commands.
- [x] Generate migration filenames with `supabase migration new`, rather than inventing timestamps.
- [x] Test SQL on isolated local PostgreSQL; populate the CLI-generated migration and verify its catalog matches the clean-install path.
- [x] Maintain an additive upgrade migration for the existing project and an updated `supabase/schema.sql` for a clean installation.
- [x] Verify both installation paths produce equivalent constraints, grants, policies, functions, and triggers at this checkpoint.
- [x] Document the pre-upgrade backup/export procedure and recovery approach before hosted application.
- [x] Use explicit upgrade statements for the existing table; do not assume editing `create table if not exists` alters it.

#### 2.2 Define the new tables

All guest-owned records use `user_id uuid not null` and server-generated timestamps. Standalone records use UUID IDs. Join-table rows use composite keys to reject duplicate relationships.

| Table | Fields | Purpose and validation |
| --- | --- | --- |
| `team_members` | `id`, `user_id`, `name`, `avatar_color`, `archived_at`, `created_at`, `updated_at` | Trimmed, nonblank name, maximum 80 characters. Optional color from an approved palette; null uses a deterministic fallback. |
| `task_assignees` | `user_id`, `task_id`, `member_id`, `created_at` | One row per assigned member. Composite primary key `(user_id, task_id, member_id)`. |
| `labels` | `id`, `user_id`, `name`, `color`, `archived_at`, `created_at`, `updated_at` | Trimmed, nonblank name, maximum 40 characters. Approved palette color and per-owner case-insensitive name uniqueness. |
| `task_labels` | `user_id`, `task_id`, `label_id`, `created_at` | One row per assigned label. Composite primary key `(user_id, task_id, label_id)`. |
| `comments` | `id`, `user_id`, `task_id`, `body`, `created_at` | Plain text, nonblank after trimming, maximum 2,000 characters. Server-generated creation time. |
| `task_activity` | `id`, `user_id`, `task_id`, `actor_user_id`, `event_type`, `payload`, `created_at` | Database-generated event records with validated event types and structured `jsonb` details. Clients can read permitted rows only. |

- [x] Add unique keys `(user_id, id)` on `tasks`, `team_members`, and `labels` for ownership-aware foreign keys.
- [x] Reference `auth.users(id)` from each owning `user_id`, with cascade behavior consistent with existing guest deletion.
- [x] Validate member/label colors as approved values rather than accepting arbitrary CSS or markup.
- [x] Allow different members to share a name; identity is the member UUID. Color/initial rendering remains in Phase 6.
- [x] Keep labels unique by normalized name within one guest, including archived labels; restoration UX remains in Phase 7.
- [x] Keep initials as a UI concern; image uploads and Supabase Storage policies are outside this version.

#### 2.3 Enforce relationship integrity and lifecycle

| Relationship | Database rule |
| --- | --- |
| Assignment → task | `(user_id, task_id)` references `tasks(user_id, id)`. |
| Assignment → member | `(user_id, member_id)` references `team_members(user_id, id)`. |
| Tag → task | `(user_id, task_id)` references `tasks(user_id, id)`. |
| Tag → label | `(user_id, label_id)` references `labels(user_id, id)`. |
| Comment → task | `(user_id, task_id)` references `tasks(user_id, id)`. |
| Activity → task | `(user_id, task_id)` references `tasks(user_id, id)`. |

- [x] Use these composite foreign keys alongside RLS; reject cross-owner links even if IDs are known. Guest access policies follow in Phase 3.
- [x] Cascade assignments, tags, comments, and activity when a task is deleted.
- [x] Add archive/restore fields and define archival as the management UI action; the views follow in Phases 6–7.
- [x] Preserve existing links through archival and permit link removal; presentation and picker filtering follow in Phases 6–7.
- [x] Validate active status on new assignment/tag links inside the database, not only in the picker.
- [x] Protect relationship updates, member/label identity/creation time, comments, and activity; API access remains closed until Phase 3's specific grants.
- [x] Leave existing tasks unassigned and untagged after migration; do not create fictitious members or comments.
- [x] Create no fabricated historical events. The existing-task history baseline message follows in Phase 9.

#### 2.4 Add indexes for the new query patterns

- [x] Index members and labels by `user_id` for workspace queries and ownership checks, using the composite unique indexes.
- [x] Use join primary keys for owner/task lookups; add `(user_id, member_id, task_id)` and `(user_id, label_id, task_id)` indexes for reverse lookups.
- [x] Index comments by `(user_id, task_id, created_at, id)` for oldest-first retrieval and stable pagination.
- [x] Index activity by `(user_id, task_id, created_at, id)` for timeline queries.
- [x] Verify every application foreign key has an index with the required leading columns, avoiding redundant owner-only indexes.

**Done when:** Reviewed upgrade SQL and a matching clean-install schema preserve existing tasks and define every new record, constraint, relationship, and index. This checkpoint produces SQL for review; hosted application is tracked separately.

### Phase 3 — Secure relationships and record activity

Owner: Codex | Status: Installed — real guest API verification pending | Next action: Retain the two-guest Data API checks in the verification checkpoint.

Deliverables: `20261108195255_secure_workspace_mutations.sql` (retired), updated [full schema](supabase/schema.sql), [read-only installation checks](supabase/verify-phase3.sql), and [security/RPC guide](docs/database-security.md). Both fresh and upgraded local PostgreSQL databases passed 45 schema checks plus 61 access/mutation checks, with catalog parity and repeat application. Read-only hosted inspection in Phase 4 confirmed the installed RPC and its expected execution permissions; hosted advisors were refreshed. Frontend services are connected in Phase 4. Two-real-guest Data API checks remain pending.

#### 3.1 Add explicit Data API grants and RLS

- [x] Enable RLS on all six new tables.
- [x] Keep unauthenticated `anon` clients without table or mutation-function access.
- [x] Give `authenticated` guests only the table/column privileges required by supported operations.
- [x] Use `(select auth.uid()) = user_id` for row ownership and retain SELECT policies for rows that can be updated.
- [x] Use both `USING` and `WITH CHECK` on UPDATE policies.
- [x] Require task ownership on child records and reject ownership changes through column privileges and policies.
- [ ] Test access through the Data API; table grants and RLS must both work.

| Table | Permitted guest operations |
| --- | --- |
| `team_members`, `labels` | Read own records; create and edit allowed fields; archive/restore through allowed updates. |
| `task_assignees`, `task_labels` | Read own links, insert permitted links, and delete own links. Keys cannot be updated in place. |
| `comments` | Read own task comments and insert comments on own tasks. Editing/deleting comments is deferred. |
| `task_activity` | Read history for own tasks only. No direct INSERT, UPDATE, or DELETE privileges. |

#### 3.2 Save task changes atomically

- [x] Add the SQL RPC contract for saving tasks and relation sets atomically; generated TypeScript and service wiring follow in Phase 4.
- [x] Use `SECURITY INVOKER` for this application function so ordinary grants and RLS remain active.
- [x] Resolve the owner from `auth.uid()` and reject unauthenticated requests; never trust a supplied owner or actor ID.
- [x] Lock the task row during an update, validate all incoming IDs, and apply only actual relationship differences.
- [x] Treat an omitted relationship array as unchanged and an empty array as remove all; reject or normalize duplicate IDs.
- [x] Return the saved task and complete assignment/label data after commit.
- [x] Reject the entire save if any field, member, label, relationship, or event write fails.
- [x] Reject stale edits using the exact server-returned `updated_at` token; frontend draft retention and reconciliation follow in Phase 4.
- [x] Ensure assignment/tag-only updates also touch the parent timestamp without generating a fictitious field-edit event.
- [x] Route create/edit/status and relation-set saves through the typed RPC service in Phase 4; new assignment/tag controls follow in the UI phases.
- [x] Use task-first row locks and locked member/label active-state checks; parallel HTTP integration testing remains in Phase 18.

#### 3.3 Capture history at the database layer

- [x] Define event types for creation, status changes, field edits, assignee additions/removals, and label additions/removals.
- [x] Add task and join-table triggers so writes through either the UI or a permitted direct client produce corresponding activity.
- [x] Write activity in the same transaction as its source mutation; a failed save must leave neither partial data nor a success event.
- [x] Keep the activity table read-only to guests. An ordinary invoker trigger cannot append into a table that rejects guest inserts.
- [x] For this narrow append operation, use a reviewed `SECURITY DEFINER` trigger function in a non-exposed `private` schema, with an empty `search_path` and fully qualified references.
- [x] Restrict the function to the intended trigger tables/events, validate the authenticated owner against the source row, and derive actor, payload, and timestamps from trusted database context.
- [x] Revoke direct function execution from public API roles; do not expose a client-callable “insert activity” endpoint or accept arbitrary event payloads from the UI.
- [x] Define cascade cleanup behavior explicitly: task/auth-user deletion must not fail because a child trigger tries to append history to a disappearing task.
- [x] Record only meaningful differences; no-op saves and timestamp-only updates must not duplicate events.
- [x] Snapshot member/label names and old/new values in event payloads so later renaming or archival does not rewrite history.
- [x] Recheck hosted security/performance advisors after installation and review privileged functions. Missing-policy and public privileged-helper execution findings are resolved; intentional guest access and unused-index notices are documented.

**Done when:** Guest clients can perform their allowed operations, cross-owner references are rejected, task saves are atomic, and history cannot be forged, edited, or deleted directly by guests.

### Phase 4 — Extend types, services, and state

Owner: Codex | Status: Complete | Next action: Phase 5 navigation and task details are ready for review.

Deliverable: [Typed data-layer guide](docs/data-layer.md). Generated database types, typed services, task/workspace/detail stores and hooks, stable request IDs, pagination, and RPC integration are implemented. The existing board uses canonical task IDs and full-precision edit tokens. Lint and the production build pass; 29 tests pass across 7 files. New feature screens and navigation remain in their later phases; no SQL changes are required here.

#### 4.1 Extend the current project structure

Create files when needed, keeping the existing component/service/hook separation.

| Location | Responsibility |
| --- | --- |
| `src/shared/types/database.ts` | Generated Supabase types after the migration is applied to a test database. |
| `src/features/team/types.ts`, `src/features/labels/types.ts` | Member and label domain/draft types. |
| `src/features/comments/types.ts`, `src/features/activity/types.ts` | Comment rows and discriminated activity event payloads. |
| `src/features/tasks/types.ts` | Separate persisted task fields from a task view model with assignees and labels. |
| `src/features/team/services/team.ts`, `src/features/labels/services/labels.ts` | Guest-owned member and label queries/mutations. |
| `src/features/tasks/services/tasks.ts` | Existing reads/status operations plus transactional task saves. |
| `src/features/comments/services/comments.ts`, `src/features/activity/services/activity.ts` | Task-specific comment and timeline reads; comment creation. |
| `src/features/workspace/useWorkspaceData.ts` | Members/labels and board relationship state. |
| `src/features/tasks/hooks/useTasks.ts` | Existing task operations extended for the saved task view model. |
| `src/features/tasks/hooks/useTaskDetails.ts` | Detail-only comment/activity loading, pagination, and recovery. |
| `src/app/hooks/useWorkspaceNavigation.ts` | Query-string view/task navigation and Back/Forward handling. |
| `src/features/tasks/details/TaskDetailPanel.tsx` | Task metadata, comment/activity tabs, save and close behavior. |
| `src/features/team/components/AssigneePicker.tsx`, `src/features/labels/components/LabelPicker.tsx`, `src/features/team/components/MemberAvatar.tsx` | Reusable multi-selection and card/header presentation. |
| `src/features/comments/components/CommentList.tsx`, `src/features/comments/components/CommentComposer.tsx`, `src/features/activity/components/ActivityTimeline.tsx` | Detail-view discussion and history. |
| `src/features/team/pages/TeamPage.tsx`, `src/features/labels/pages/LabelsPage.tsx` | Management views within the existing app shell. |
| `supabase/schema.sql`, `supabase/migrations/` | Clean-install SQL and generated additive upgrade migration. |
| `supabase/tests/` | Ownership, relationship, activity, and migration integration tests. |

#### 4.2 Load and mutate data consistently

- [x] Load tasks, members, labels, and task relationships after guest auth; parallelize independent requests.
- [x] Use nested relational queries or bounded batch queries; avoid one assignee/label request per task card.
- [x] Fetch comments and activity only for the opened task, with independent loading/error states.
- [x] Key detail data by guest ID and task ID; ignore responses from a closed panel or previously selected task.
- [x] Keep a single canonical board task state. The existing selected task resolves by ID; the expanded detail view follows in Phase 5.
- [x] Retain existing form drafts and provide comment-draft state on failure; guard duplicate submissions. The detail UI consumes these contracts in Phase 5.
- [x] Serialize or block overlapping mutations on the same task, including a drag while a detail save is pending.
- [x] Update board, detail, lookup records, filters, and summary state from committed server results.
- [x] Do not synthesize authoritative activity in the browser; invalidate/refetch the affected timeline after successful changes.
- [x] For ambiguous network outcomes, reconcile with the server before retrying creation or appending comments; use stable request IDs where needed to avoid duplicates.

**Done when:** Typed services and state can load and save the full task model, handle rollback/conflicts, and keep the board and selected task synchronized.

### Phase 5 — Add workspace navigation and task details

Owner: Codex | Status: Complete | Next action: Phase 6 team management is ready for review.

Deliverable: [Navigation and task-detail guide](docs/navigation-and-task-details.md). URL navigation, read-only Team/Labels directories, shared task fields, multiple-selection controls, comment/activity tabs, and draft protection are implemented. Full management forms remain in Phases 6–7; comments/activity receive their dedicated follow-up checks in Phases 8–9. No new SQL is required. Browser appearance, native focus containment, dragging, and live persistence remain manual checkpoint checks.

#### 5.1 Add management views

- [x] Add Board, Team, and Labels navigation inside the existing app shell.
- [x] Parse supported query parameters, handle unknown views gracefully, and subscribe to browser navigation.
- [x] Keep the guest session and loaded workspace data alive between management views.
- [x] Restore active board filters after returning from Team or Labels.
- [x] Use the existing black–green tokens for navigation, panels, buttons, and focus states.

#### 5.2 Build the detail panel

- [x] Open task details through a card title/action without interfering with the separate drag handle.
- [x] Show title, description, status, priority, due date, assignee picker, label picker, and delete action.
- [x] Reuse existing task form fields and validation, while avoiding nested forms or nested modal dialogs.
- [x] Provide Comments and Activity tabs with clear loading, empty, and error states.
- [x] Support direct task links and an inaccessible/deleted-task message without revealing another guest's data.
- [x] Trap focus where appropriate, support Escape and an accessible close control, and return focus to the opener when available.
- [x] Preserve unsaved drafts and confirm intentional discard on close/navigation.
- [x] Close the panel after successful task deletion and remove related client state.
- [x] Lazy-load detail/management surfaces and keep mobile controls and scrolling usable.

**Done when:** Navigation and the detail panel work with refresh, Back/Forward, keyboard input, and narrow screens, with no regression to task creation or drag/drop.

### Phase 6 — Build team members and multiple assignees

Owner: Codex | Status: Complete | Next action: Assignment save/refresh/history is user-verified; retain remaining mobile/isolation checks in Phase 18.

Deliverable: [Team member and assignee guide](docs/team-members.md). Inline create/edit forms, archive/restore views, assignment counts, board/card avatars, and searchable multi-assignment on creation/edit are implemented. Existing task links survive archival. Hosted constraints and table access were checked read-only; no new SQL or hosted data writes were needed. Live refresh/history and browser interaction checks remain below for this checkpoint.

#### 6.1 Manage the guest's team

- [x] Build member creation with a visible name label and optional palette color selection.
- [x] Reject blank or oversized names in both UI and database.
- [x] Show member initials, name, color, active/archived status, and edit/archive/restore controls.
- [x] Display active member avatars in the board header, with overflow such as `+3` and a Manage team entry point.
- [x] Show a useful empty-team state and preserve entered values after a failed save.
- [x] Make clear that these are workspace profiles, not invitations or newly authenticated accounts.

#### 6.2 Assign several members to tasks

- [x] Use a checkbox-based multi-select with a search field when the list is long.
- [x] Allow zero, one, or multiple assignees on creation and edit; zero means Unassigned.
- [x] Save assignment changes through the atomic task mutation from Phase 3.
- [x] Display a small avatar stack on cards; expose full assignee names through accessible text and an overflow indicator.
- [x] Keep archived assignees visible with an archived marker until removed; prevent adding archived members.
- [x] Propagate member renames/colors to cards and pickers without changing historical event snapshots.
- [x] Verify assignment additions/removals produce the expected activity and survive refresh. User confirmed this browser check on November 9, 2026.

**Done when:** A guest can manage members and persist several assignees per task, with consistent avatars on the board and accurate assignment history.

### Phase 7 — Build custom labels and task tagging

Owner: Codex | Status: Implemented — checkpoint accepted | Next action: Keep live label persistence/activity checks in Phase 18; Phase 8 is ready for review.

Deliverable: [Label and task-tagging guide](docs/labels-and-tags.md). Label create/edit/archive/restore, case-insensitive duplicate recovery with a restore offer, usage counts, creation/detail pickers, and card chips with expandable overflow are implemented. Hosted constraints and table access were checked read-only; no new SQL or hosted data writes were needed. Live refresh/history and browser interaction checks remain manual checkpoint items. Board label filtering remains in Phase 10.

#### 7.1 Manage custom labels

- [x] Add label creation, rename, color, archive, and restore controls in the Labels view.
- [x] Use examples such as Bug, Feature, and Design as placeholders, not shared global records.
- [x] Report case-insensitive duplicate names with an actionable message.
- [x] Offer restore for a matching archived label rather than creating an ambiguous duplicate.
- [x] Render text safely and keep label text readable against its palette background.

#### 7.2 Attach multiple labels

- [x] Add a multi-select picker to creation and task details.
- [x] Allow zero or multiple labels and save relationship changes atomically with other task edits.
- [x] Render label chips on cards with a compact overflow treatment for long lists.
- [x] Update label names/colors wherever they appear after an edit.
- [x] Preserve archived labels already on tasks, allow removal, and reject new archived-label links.
- [ ] Verify label additions/removals are recorded in activity and persist after refresh.

**Done when:** Labels can be managed and attached to tasks, their card chips remain consistent, and relationships remain private to the guest.

### Phase 8 — Add persistent task comments

Owner: Codex | Status: Implemented — checkpoint accepted | Next action: Retain live comment persistence/isolation checks in Phase 18; Phase 9 is ready for review.

Deliverable: [Task comments guide](docs/task-comments.md). Separate list/composer components, explicit post/page retries, validation, precise chronological ordering, recent-post gaps, reload recovery, and draft/identity isolation are implemented. Hosted table constraints, grants, index, and cascade configuration were checked read-only. No new SQL or hosted comment writes were needed; live browser persistence/deletion and guest API isolation remain manual/Phase 18 checks.

#### 8.1 Read comments

- [x] Query the separate `comments` table using the selected task and guest identity.
- [x] Display comments oldest first using `created_at` plus ID as a stable tie-breaker.
- [x] Show the guest author, plain-text body, and a localized timestamp using `<time datetime="...">`.
- [x] Include an exact local date/time when using a relative-time display. Comments currently show exact localized times.
- [x] Keep initial loading, no-comments, read-error, and Load more states distinct.
- [x] Use a stable cursor and batch size, such as 50 comments, so long discussions do not block opening a task.

#### 8.2 Write comments

- [x] Reject whitespace-only comments and enforce the 2,000-character limit in both layers.
- [x] Disable duplicate submissions while a comment is saving; leave the draft intact on failure.
- [x] Append the saved server row and clear the draft only after a confirmed successful insert.
- [x] Reconcile uncertain network outcomes before retrying so the same comment is not posted twice.
- [x] Show an inline failure and Retry action without closing the detail panel.
- [x] Preserve line breaks and render content as plain text, with no raw HTML injection.
- [x] Do not allow choosing an assignee profile as the authenticated comment author.
- [x] Keep comments attached to their task; deleting the task removes them through the database relationship. Hosted cascade configuration is verified; live deletion remains a manual check.

**Done when:** Comments persist in their own table, appear chronologically with timestamps, and handle validation, failures, task switching, and pagination correctly.

### Maintenance checkpoint — Organize source and styles

Owner: Codex | Status: Complete | Next action: Continue feature work through the Phase 9 checkpoint.

Deliverable: [Architecture and style guide](docs/architecture.md). Feature folders now contain their UI, data operations, types, and colocated tests. The app shell, board page, task-detail editor, and activity view have separate responsibilities. CSS uses small ordered modules; a comparison confirms that all 324 original rules, declarations, and media queries retain their cascade order. This checkpoint adds no feature behavior, SQL changes, or dependencies.

### Phase 9 — Display the task activity timeline

Owner: Codex | Status: Implemented — core browser checks passed | Next action: Clock/mobile and longer-history browser checks remain; Phase 10 is the next implementation checkpoint.

Deliverable: [Task activity guide](docs/task-activity.md). Typed summaries and old/new values, saved name snapshots, guest actor labels, safe fallbacks, relative-time updates, manual refresh, and same-cursor page retry are implemented in feature-specific modules. Existing local SQL suites pass fresh/upgrade checks for no-ops, rollback, history protection, task deletion, and auth cleanup. Hosted configuration was checked read-only; no new SQL or hosted data changes were required. Real guest API isolation and browser persistence/interaction remain manual/Phase 18 checks.

#### 9.1 Define readable event rendering

| Event type | Example display |
| --- | --- |
| `task_created` | Created this task · 2 hours ago |
| `status_changed` | Moved from To Do → In Progress · 2 hours ago |
| `task_edited` | Updated title and due date · 1 hour ago |
| `assignee_added` / `assignee_removed` | Assigned Alex / Removed Alex · 40 minutes ago |
| `label_added` / `label_removed` | Added Bug / Removed Design · 15 minutes ago |

- [x] Render event payloads through typed formatter functions, not stored HTML.
- [x] Use stored old/new values and member/label name snapshots for historical text.
- [x] Do not call a guest-managed member the actor; display the authenticated guest as the actor.
- [x] Provide a safe fallback for an unknown event type or older payload version.

#### 9.2 Build timeline behavior

- [x] Show Activity oldest first with stable timestamp/ID ordering and Load more pagination.
- [x] Display relative time plus an accessible exact local timestamp.
- [x] Refresh relative labels while the panel is open and clean up timers on close.
- [x] Refetch affected history after field edits, drag status changes, assignment changes, and label changes.
- [x] Show an explicit baseline message for tasks that existed before history capture was enabled.
- [x] Confirm a no-op save produces no event, while a failed or rolled-back mutation produces no success event. Native local SQL and client synchronization tests cover these cases.
- [x] Verify parent-task deletion and auth-user cleanup succeed without orphaned history or trigger errors. Native local SQL covers both paths; real JWT/API verification remains in Phase 18. Shared-content retention after account deletion is a new Phase 12/13 requirement.

#### 9.3 User-reported browser verification

Confirmed by the user on November 9, 2026:

- [x] Add/remove an assignee, save, refresh, and verify the recorded names.
- [x] Move task status and edit fields; confirm Activity and View changes show the correct history.
- [x] Go offline before saving; confirm the draft remains and no success event appears.

Clock/mobile, longer-history pagination/retry, and live cleanup checks remain in the [activity review guide](docs/task-activity.md). Real cross-guest/group JWT/API isolation remains in Phase 18.

**Done when:** The timeline reflects committed database changes accurately, survives refresh, and cannot be rewritten through guest access.

### Phase 10 — Complete filters, due dates, and summaries

Owner: Codex | Status: Implemented — ready for browser review | Next action: Review this checkpoint before Phase 11.

Deliverable: [Board filters, dates, and summary review](docs/board-filters.md). On November 9, 2026, all 135 tests across 30 files, ESLint, and the TypeScript/production build passed. The focused 34-test run also passed with `TZ=America/New_York`, covering daylight-saving boundaries. Browser appearance, keyboard/touch interaction, and real tab suspension remain review checks. No SQL, dependencies, or hosted data changed in this checkpoint.

#### 10.1 Combine search and filters

- [x] Retain the existing search bar: title matches are required, and the existing description-search behavior may remain.
- [x] Keep case-insensitive, trimmed search and the current priority filter.
- [x] Add an assignee filter with All, Unassigned, and selected member IDs.
- [x] Add a label filter with All, Unlabeled, and selected label IDs.
- [x] Match ANY selected member within the assignee filter and ANY selected label within the label filter.
- [x] Combine search, priority, assignee, and label groups using AND.
- [x] Keep archived records available as filter options if they are still attached to tasks; visibly mark them archived.
- [x] Add active-filter chips and one Clear filters action that resets every group.
- [x] Derive visible tasks from canonical data; filtering must not remove hidden tasks or their relationships.
- [x] Keep column counts explicit, such as `2 of 6`, and distinguish no matches from an empty workspace.
- [x] Preserve filters through task details and management navigation using supported query parameters.
- [x] Ignore unknown/deleted filter IDs gracefully and keep the controls usable on mobile.

#### 10.2 Finish due-date behavior

| Condition | Indicator | Included in overdue count? |
| --- | --- | --- |
| Incomplete task due before the local current date | Red badge/icon and Overdue text. | Yes |
| Incomplete task due today | Amber badge/icon and Due today text. | No |
| Incomplete task due in the next 1–3 calendar days | Green-accent badge/icon and Due soon text. | No |
| Later due date | Neutral date. | No |
| Completed task | Neutral saved due date, with no urgency warning. | No |
| No due date | No due date state. | No |

- [x] Reuse the existing `getDueState` and `formatDueDate` utilities; do not parse a date-only string as UTC midnight.
- [x] Verify calendar-date comparisons across month/year boundaries and daylight-saving changes.
- [x] Update urgency at local midnight and when the page becomes visible after being backgrounded; clear timers/listeners on unmount.
- [x] Keep urgency text/icons alongside color and expose an understandable accessible label.
- [x] Update urgency immediately after due-date or status changes.

#### 10.3 Clarify summary scope

- [x] Keep Total, Completed, and Overdue as whole-board counts and visibly label that scope.
- [x] Show filtered results separately, such as `Showing 4 of 18 tasks`.
- [x] Derive counts from unique tasks, not joined query rows; multiple labels or assignees must not inflate totals.
- [x] Update counts after task creation/deletion, status changes, due-date edits, and local-date changes.
- [x] Do not treat failed task loading as a successfully empty board with authoritative zero counts.

**Done when:** Combined filters return predictable results, urgency remains correct as time changes, and summary counts are accurate and clearly scoped.

### Phase 11 — Define accounts and shared-group behavior

Owner: Codex | Status: Design complete — ready for schema checkpoint | Next action: Implement Phase 12, then stop for SQL review.

Deliverable: [Accounts and shared-group design](docs/shared-groups-design.md). The user confirmed the two account/permission choices on November 9, 2026. Current code/schema and official Supabase Auth documentation were reviewed. This checkpoint updates the plan only; runtime, schema, hosted Auth configuration, and data are unchanged. Phase 10's 135-test/lint/build results remain the baseline and were not rerun for documentation edits.

#### 11.1 Define identity and collaboration

- [x] Choose email/password accounts and globally unique usernames for invitation lookup, including guests.
- [x] Define same-UUID guest registration so existing groups, tasks, comments, and invitations survive.
- [x] Verify Supabase's built-in guest email-verification/password flow; plan callback/recovery handling for the existing client configuration.
- [x] Let all active group members edit group tasks and send invitations; reserve ownership/deletion and other-member removal for the current owner.
- [x] Require recipient acceptance before group access or new task assignment; use an in-app inbox that guests can receive.
- [x] Record the later fresh-start decision: old application data and placeholders may be discarded; guest registration preserves new-schema work.
- [x] Define data ownership, group switching, account-change behavior, live updates, and migration/release gates.
- [x] Move final security/experience verification to Phase 18 and documentation/release to Phase 19.

**Done when:** The account, group, invitation, permission, and data-preservation contracts are concrete enough to implement safely.

### Phase 12 — Add profiles, groups, and migration

Owner: Codex | Status: Implemented locally — ready for SQL review | Next action: Phase 13 is implemented below; use the complete SQL setup guide for installation.

Deliverables: [clean schema](supabase/schema.sql), [destructive reset migration](supabase/migrations/20261109072133_add_shared_group_foundation.sql), [read-only verification](supabase/verify-phase12.sql), and [setup/review guide](docs/shared-groups-migration.md). The user approved discarding old data during this checkpoint. PostgreSQL 17 passed 39 checks on a fresh schema and 39 after resetting populated old data; catalogs match. No hosted schema/data/Auth settings or frontend code changed. This schema is not compatible with the old frontend; apply only after the later API/frontend readiness gates.

#### 12.1 Build the group data model

- [x] Inspect the installed schema, constraints, grants, policies, and triggers; verify CLI 3.0.0 and migration help. Hosted Auth settings are not exposed by the connected tools and remain a Phase 14 setup check.
- [x] Add Auth-linked profiles, normalized unique usernames, display names/colors, protected timestamps, collision-safe provisioning, and one empty private group per actual user.
- [x] Add groups, active/inactive memberships, invitation states/expiry, and database-enforced active group ownership.
- [x] Add group-scoped tasks, labels, links, comments, and activity with creator/author attribution and same-group foreign keys.
- [x] Add real-user assignments referencing active membership; remove placeholder-member tables from the new model.
- [x] Retain shared content/names when a non-owner account is deleted, remove its assignments, and block owner deletion until ownership/groups are handled.

#### 12.2 Prepare clean setup and an explicit reset

- [x] Replace the old preservation/backfill plan with the user's approved fresh application start.
- [x] Provide one clean-install schema and one transactional destructive reset that retain Auth accounts and create no fictional users.
- [x] Remove obsolete owner policies/RPCs in the reset; import no legacy task, label, comment, member, assignment, or activity rows.
- [x] Index membership, group boards, invitation inboxes/pending requests, relationship keys, and paginated discussion.
- [x] Generate the migration through the CLI and test fresh/reset catalog parity using isolated disposable databases.
- [x] Enable RLS and explicitly close API grants/policies until Phase 13, including under permissive project defaults.
- [x] Document installation choices, incompatibility with the old frontend, verification boundaries, and the review checkpoint. No SQL needs to be run by the user yet.

**Done when:** The clean group model and explicit reset pass local integrity/access/cascade checks, with shared APIs closed and hosted installation deferred until the frontend is ready.

### Phase 13 — Secure group access and mutations

Owner: Codex | Status: Implemented — user-reported SQL verification passed | Next action: Phases 14–16 frontend implementation and review below.

Deliverables: [setup instructions](docs/shared-groups-migration.md), [security/API contract](docs/group-security.md), [complete reset](supabase/reset.sql), [clean schema](supabase/schema.sql), [Phase 13 migration](supabase/migrations/20261109075450_secure_shared_group_operations.sql), and [read-only verification](supabase/verify-phase13.sql). On November 9, 2026, 76 access/mutation checks passed on each fresh/reset path, 39 foundation checks passed, and three two-connection races passed. Reapplication, complete reset after shared operations, catalog parity, and local advisors passed. No hosted schema/data/Auth settings or frontend code changed. Native SQL claims exercise RLS/functions, not real JWT/HTTP Auth; managed installation checks remain in later verification.

#### 13.1 Enforce group membership

- [x] Implement current active database membership policies; keep the removed owner-only policies/RPCs absent from the clean model.
- [x] Give guests and registered users the same collaboration permissions after acceptance; never authorize using user-editable metadata or a supplied group/user ID.
- [x] Enforce read/write scope for tasks, labels, real-user links, profiles, comments, activity, group records, and invitation previews.
- [x] Restrict profile edits to self and expose only the minimal fields needed by same-group members or authorized invitation lookup/preview.
- [x] Validate same-group parents and active assignment targets in the database, with protected creator/author IDs and timestamps.
- [x] Implement bounded authenticated exact-username/UUID lookup and invitation limits without exposing the Auth directory or email addresses.

#### 13.2 Keep operations atomic

- [x] Add atomic group creation/owner membership, invitation send/accept/decline/revoke, leave/remove, ownership transfer, and owner-only deletion operations. Remove active assignments on departure with committed activity while retaining historical member/actor references.
- [x] Enforce seven-day expiry, one pending request per group/recipient, recipient-only acceptance, active sender checks, retry idempotency, and re-invitation after terminal outcomes.
- [x] Serialize accept/revoke, group deletion, owner transfer, member removal, and conflicting task writes; reject self-invites, already-active members, and unauthorized reactivation.
- [x] Preserve exact task conflict tokens, relation-set replacement, transaction rollback, and server-generated activity with real actor snapshots; deny forged history and caller-selected authors.
- [x] Do not use creator/author attribution as authorization after membership is lost. Keep ordinary RPCs invoker-scoped where possible and narrowly review any private privileged helper.
- [x] Test owner/member/recipient/outsider/removed-member behavior, rollback, no-ops, concurrency, and account-deletion retention locally; run advisors and record explicit grants/RLS results.

**Done when:** Membership and invitation state, not record creation or UI filtering, determine access; all state transitions and committed task history remain consistent.

### Phase 14 — Build accounts and guest registration

Owner: Codex | Status: Implemented — local checks passed, hosted Auth/browser review pending | Next action: Configure native Auth and verify same-UUID registration/recovery using the account review guide.

Deliverable: [Accounts and shared groups](docs/accounts-and-groups.md). Native Auth/session changes, resumable same-UUID guest conversion, profiles, PKCE callbacks, and password recovery are implemented. Auth/email settings were not changed by the agent. Mocked tests verify the flow; real confirmation/recovery delivery and another-browser login remain manual acceptance checks.

#### 14.1 Add the account experience

- [x] Regenerate database types and add small account/profile services, validation, state, and UI in feature folders.
- [x] Replace one-time guest initialization with Auth change subscriptions; handle guest entry, login, registration, sign-out, session refresh/expiry, and account switching without stale cross-account data.
- [x] Show account ID, editable unique username, display name/color, and a clear Guest/Register account action.
- [x] Upgrade the current guest's identity through supported Supabase email linking, built-in verification, and password setup; verify the UUID remains unchanged and partial conversion can resume.
- [x] Handle duplicate username/email, expired confirmation, resend, weak password, lost network, and pending registration while retaining work and appropriate drafts.
- [x] Add existing-account email/password sign-in and deliberate account switching. Explain guest-work retention before leaving that identity; do not silently merge, delete, or transfer its groups.
- [x] Implement native password recovery and explicit confirmation/recovery completion for local/hosted URLs; do not auto-create a new guest during callbacks.
- [x] Document required manual-linking, email delivery, redirect, and Auth settings. Use Supabase-managed session persistence; never persist plaintext passwords, log tokens, or expose credentials/service secrets in profiles or Vite.
- [x] Review native password-security settings and leaked-password protection where the project plan supports it; the read-only hosted baseline flags that setting. No settings were changed during Phase 13.

**Done when:** A guest can register, keep the same identity/work, and log back in from another browser; sign-in, sign-out, and recovery produce correct session/profile state.

### Phase 15 — Build groups, invitations, and members

Owner: Codex | Status: Implemented — local checks passed, two-browser review pending | Next action: Review invitation acceptance, group switching, and owner/member actions with two actual sessions.

Deliverables: [Groups and invitation review](docs/accounts-and-groups.md#groups-and-invitations) and [real members](docs/team-members.md). Group creation/switching, recipient previews, paginated invitation states/actions, actual member lists, and ownership/leave/removal/deletion controls replace fictional profile creation.

#### 15.1 Replace manually created identities

- [x] Add group services/state, group creation, a joined-groups page, and a header switcher with empty/loading/error/retry states.
- [x] Display the initial empty private group as an ordinary group that its members can share by invitation.
- [x] Replace Add member/name-color creation with Invite by exact username or account ID; display the resolved minimal identity before sending.
- [x] Add incoming and authorized sent invitation views with pending/accepted/declined/revoked/expired states, accept/decline/revoke actions, and safe retry.
- [x] Allow invitations to existing anonymous guest profiles as well as registered accounts; acceptance must occur under the actual invited identity.
- [x] Show actual group members and self-profile links; eliminate manual name/color identity creation.
- [x] Implement own leave and owner-only member removal, transfer, and confirmed group deletion, including the last-owner guard.
- [x] Extend supported navigation for Account, Groups, Members, Invitations, and `group=<UUID>` while preserving direct-link/error behavior and narrow-screen controls.

**Done when:** Two independently signed-in users can join the same group through a recipient-accepted request, and one user can belong to and switch between multiple groups.

### Phase 16 — Scope task features to the active group

Owner: Codex | Status: Implemented — local checks passed, manual review pending | Next action: Review shared task work; stop here before Phase 17 Realtime.

Deliverable: [Group-scoped workspace contract and review](docs/accounts-and-groups.md#group-scoped-workspace). Generated types match the installed schema; group RPCs/read filters, real author snapshots, identity/group/task isolation, exact conflict tokens, per-group filters/scroll, draft/pending guards, focus/manual/denied-access recovery, and shared board composition are implemented. All 162 tests in 32 files, ESLint, and the production build passed on November 9, 2026. Native email, real JWT/client access, and visual/touch checks remain manual/Phase 18; automatic Realtime updates remain Phase 17. No new SQL, dependencies, hosted mutations, or Auth setting changes were made in this batch.

#### 16.1 Connect shared task work

- [x] Key stores, caches, requests, mutations, cursors, and selected details by Auth identity and group; ignore late responses from earlier groups/accounts.
- [x] Replace owner-only queries/RPC arguments with validated group-aware access for tasks, labels, assignments, comments, and history.
- [x] Populate assignment pickers from accepted active group members; reject pending, foreign-group, and inactive targets.
- [x] Show real author/actor names in comments/activity; preserve historic name snapshots, no-op semantics, and immutable history after renames/departures.
- [x] Scope filter options, summary totals, empty/error states, and task direct links to the active group. Restore filters/scroll per group without reusing foreign member/label IDs.
- [x] Run unsaved-draft/pending-operation guards when switching group/account and clear incompatible task overlays. Do not expose cached content after membership is lost.
- [x] Preserve guest UUID, group memberships, and newly created task/comment/history data when registering that guest.
- [x] Extend focused service, state, navigation, and composition tests for shared editing, two groups, rapid switching, stale reads, archived labels, member departures, and conflict handling.

**Done when:** All existing task features work inside the selected group for any active member, with accurate attribution and no data mixing across groups or identities.

### Phase 17 — Synchronize shared work

Owner: Codex | Status: Installed; user confirmed live updates working | Next action: Phase 18 has verified native WebSocket delivery/access; retain extended browser acceptance there.

Deliverables: [Realtime SQL/setup and review](docs/realtime.md), [additive migration](supabase/migrations/20261109141005_add_private_workspace_realtime.sql), and [read-only verifier](supabase/verify-phase17.sql). Private content-free Broadcast signals drive scoped/coalesced background reads, draft-safe history merging, independent access-loss hints, reconnect/focus/30-second recovery, and narrow-screen connection feedback. On November 9, 2026, 179 tests across 34 files, lint, and the production build passed. PostgreSQL 17 passed 32 Realtime checks on each fresh/upgrade path plus the existing 76 checks per path, 39 foundation checks, three concurrency races, reapplication, and catalog/reset parity. Local advisors reported no warnings/errors. No hosted migration/data/Auth/Realtime settings were changed; actual WebSocket delivery, two-browser timing, and visual/touch behavior remain manual.

#### 17.1 Reflect committed changes across users

- [x] Verify current Supabase Realtime APIs, RLS behavior, publication setup, and deletion limitations before choosing channel/filter contracts. The hosted ownership correction replaces redundant managed-table ALTER with a catalog check; 32 local Realtime checks now include an ownership guard.
- [x] Subscribe only to authorized group/task and identity-specific invitation/membership changes; do not publish unrestricted group contents.
- [x] Refetch authoritative rows after changes and update cards, assignments, labels, comments, activity, counts, and inbox state without duplicate records/events.
- [x] Keep active drafts during remote edits, preserve exact update tokens, and surface conflicts rather than silently overwriting newer work.
- [x] Tear down channels on group/account changes and recover after reconnect or a missed event; retain retry and manual refresh paths.
- [x] Revalidate membership on focus/reconnect, periodically while open, and on authorization failures; do not rely on receiving a removal event after SELECT access is revoked.
- [x] Clear inaccessible group caches/details and redirect to a safe group/no-groups state after leave/removal/deletion, while RLS independently rejects reads/writes.
- [ ] Test two live browser clients, reconnect, invitation acceptance, concurrent edits, member removal with an open detail, cleanup, and narrow-screen feedback.

**Done when:** Members see each other's committed changes, conflicts remain explicit, and losing group access reliably removes the active view without depending on UI authorization.

### Phase 18 — Verify security and the complete experience

Owner: Codex | Status: In progress — additive SQL fix ready for review | Next action: Apply the Phase 18 HTTP-conflict migration and read-only verifier, then finish real conflict/registered-user/browser acceptance.

Deliverable: [Phase 18 verification results and SQL checkpoint](docs/phase18-verification.md). 187 frontend tests across 35 files, lint, build, local fresh/reset parity, and three concurrent races pass. 179 actual guest/API/Realtime assertions passed with one explicit stale-conflict HTTP check skipped. Real stale saves exposed PostgREST's `40001` retry behavior; a new additive migration maps public revision errors to `PT409`. It is tested locally and not applied to the hosted project. Authorized temporary fixtures were removed. Production dependencies have no audit findings; the full audit's development-only minimatch advisory and hosted Auth/password findings are recorded for review. Phase 18 remains open for hosted fix verification, registered-user tokens, email/browser/mobile flows, and clean hosted installation.

#### 18.1 Test application behavior

- [x] Extend unit tests for combined filter semantics, Unassigned/Unlabeled, archived records, and duplicate joined rows.
- [x] Test calendar urgency, midnight refresh, completed-task dates, and whole-board statistics.
- [ ] Test member/label validation, multi-pickers, keyboard interaction, and accessible avatar labels.
- [x] Test detail navigation, tab loading, task switching, stale responses, and unsaved-draft handling.
- [x] Test comments for blank rejection, order, timestamps, draft retention, and duplicate-request recovery.
- [x] Test activity formatting, old/new values, historic names, unknown events, and no-op behavior.
- [x] Test atomic save failures, stale edit conflicts, move rollback, and overlapping task mutations. Local checks pass; native HTTP conflict verification awaits the new migration.
- [x] Retain regression coverage for guest auth, task CRUD, four columns, empty drop targets, and refresh persistence.
- [ ] Test desktop and narrow mobile flows, including multiple assignments, tags, comments, and filters.
- [x] Run lint, tests, type checks/production build, and a dependency audit appropriate to changed packages. Record the development-tooling advisory exception separately from the zero-finding production audit.
- [ ] Test guest-to-account conversion, unchanged UUID/data/memberships, verification resume/expiry, duplicate username/email, password recovery, sign-in/out, and intentional identity switching.
- [ ] Test group creation/switching, accepted membership, invitation state transitions, real-member pickers, account/group cache isolation, and removal with a dirty open task.
- [ ] Test simultaneous membership/invitation changes, live task conflicts, reconnect/refetch, and subscription cleanup without duplicate activity/comments.

#### 18.2 Verify access with real guest and registered clients

Use actual guest and registered-user access tokens against the Data API/RPC in an isolated test project. A and B share Group G; A also owns private Group H. C is an outsider/pending invitee, and D is a removed member. Repeat same-group boundary checks with a caller who belongs to both groups. Interface filtering and SQL Editor queries do not prove RLS isolation.

- [ ] Let both A and B create/edit/move/delete G tasks, manage labels, assign active members, and post comments. Confirm shared access and correct creator/author attribution.
- [ ] Verify B cannot access H and C/D cannot access G content through known IDs, nested selects, direct tables, RPCs, or Realtime. Pending invitees receive only their authorized invitation preview.
- [ ] Try linking tasks, labels, real-user assignments, and comment/history relationships across G/H in both directions, including as A who can access both groups; reject mismatched parents.
- [ ] Try forging group membership, recipient acceptance, owner roles, attribution, protected timestamps, and group IDs through raw requests.
- [ ] Try direct membership insertion/reactivation, self-invites, duplicate invites, accept after revoke/expiry, accepting another user's request, and changing an invite's target; verify transactional rejection/idempotency as specified.
- [ ] Try assigning pending/inactive/foreign members and attaching archived labels through a direct client; retain permitted existing archived-label links without granting access.
- [ ] Verify all active members may invite, only intended recipients accept/decline, and only the current owner removes others/transfers/deletes. Test former-owner privileges after transfer.
- [ ] After leave/removal, retry reads/writes using the same still-valid token and stale open detail; confirm old creator fields/compatibility RPCs do not restore access.
- [ ] Try direct INSERT, UPDATE, DELETE, and RPC-based forgery of activity; preserve append-only comments and database-generated actual actor/name snapshots.
- [ ] Verify allowed mutations append correct events once, no-ops add none, and failed transactions append none.
- [ ] Verify unauthenticated API-key-only clients cannot access the new tables/functions or invitation lookup; keep private Auth/email fields undisclosed to other users.
- [ ] Check unauthorized zero-row updates/deletes as well as explicit errors, then re-read as an authorized member; run advisors and resolve findings or record a specific reviewed exception.

#### 18.3 Verify clean setup, reset, and recovery

- [x] Reset a populated local copy of the old schema and verify old application data is discarded while Auth accounts remain.
- [ ] Apply the full schema to an empty test project and run the same guest-client checks.
- [x] Confirm generated types and application queries match both installation paths. Hosted generated types match exactly; local fresh/reset catalogs and API signatures match.
- [ ] Exercise task/group deletion cascades and verify no orphaned links, comments, or activity remain; verify non-owner account deletion and member departure retain shared content/history, and owner deletion requires the specified transfer/delete path.
- [ ] Use a coordinated backend/frontend release: the old private frontend is intentionally incompatible with the clean group model.
- [x] Record tested commit, migration version, environment, and results without storing guest tokens.
- [ ] Create work as a guest in the new schema, register it, then log in on another browser and verify its exact UUID, groups, tasks, assignments, comments, and history survived.
- [ ] Verify old placeholder profiles/links are absent, no Auth users were invented, and all new assignments reference accepted accounts.

**Done when:** All original features and the shared-account/group experience work through refresh, failures, multiple clients, and access loss; database boundaries and both installation paths are verified directly.

### Phase 19 — Update documentation and release

Owner: ___ | Status: Not started | Next action: Document verified features and prepare the reviewed release.

#### 19.1 Update the project handoff

- [ ] Update README features, navigation, domain model, setup, and known limitations to match the verified build.
- [ ] Document member/label archival, multiple assignments, comment rules, filter semantics, history retention, and summary scope.
- [ ] Explain the difference between actual group members and anonymous guest accounts; explain the approved discard of old placeholder records.
- [ ] Document unique usernames/account IDs, native email confirmation/recovery setup, group permissions, invitation acceptance/expiry, account switching, Realtime recovery, and access revocation.
- [ ] Include explicit destructive-reset instructions and clean-schema instructions, with their appropriate release gates.
- [ ] Document group/invitation/task RPCs, membership-based RLS/relationship constraints, and the narrowly scoped private helper/activity privileges.
- [ ] Add the exact repository/live URLs and current screenshots once available.
- [ ] Verify setup instructions against a clean checkout and keep `.env.local` ignored.

#### 19.2 Deploy the tested update

- [ ] Confirm the intended GitHub repository, hosting project, Supabase project, and tested commit.
- [ ] Apply the explicitly approved fresh/reset database path and coordinated frontend release from Phase 18; avoid accidentally replaying obsolete owner-schema setup.
- [ ] Deploy the frontend using the existing Vite build settings and public Supabase environment values.
- [ ] Verify Account, Groups, Members, Invitations, Board, Labels, confirmation/recovery, and group/task direct links on the deployed URL, including refresh and Back/Forward.
- [ ] Repeat guest → register → log in elsewhere → create group → invite guest/user → accept → assign → comment → move → inspect history → refresh across two clients.
- [ ] Repeat shared-group/outsider/removed-member access checks, group switching, Realtime recovery, and application/database error inspection before accepting release.
- [ ] Keep backup/recovery instructions available; do not use a destructive schema rollback as a routine frontend rollback.

#### 19.3 Update assessment materials

- [ ] Include all implemented enhancements and the reasons for the database/UI design choices.
- [ ] Include the full final SQL: every table, constraint, index, grant, policy, function, and trigger.
- [ ] Include clickable live-app and GitHub links, local setup, migration instructions, and verification results.
- [ ] Explain remaining limits, such as unrecoverable unregistered guests after storage loss, automatic account merging, invitation emails, OAuth, and image uploads. Document verified Realtime behavior and recovery rather than listing collaboration as future work.
- [ ] Keep the required `firstname_lastname_task_manager_assessment.pdf` filename pattern when generating a PDF.
- [ ] Check the document against the final deployed app and exclude credentials or confidential assessment text.

**Done when:** The live update, reproducible SQL, README, tests, and final submission describe the same verified behavior.

## 3. Time budget and stopping points

These are incremental planning estimates for extending the existing application, not promises or a restart of the original assessment clock. Track actual time and review the remaining assessment time before beginning. All seven feature groups remain requested scope; raise a schedule conflict rather than marking unfinished work complete.

| Work | Target |
| --- | --- |
| Baseline, scope, and view design — Phase 1 | 25 minutes |
| Additive schema and migration — Phase 2 | 60 minutes |
| RLS, atomic saves, and activity capture — Phase 3 | 75 minutes |
| Types, data services, and state — Phase 4 | 45 minutes |
| Navigation and task detail shell — Phase 5 | 45 minutes |
| Team management and multiple assignees — Phase 6 | 50 minutes |
| Label management and task tagging — Phase 7 | 40 minutes |
| Persistent comments — Phase 8 | 40 minutes |
| Activity timeline — Phase 9 | 30 minutes |
| Combined filters, due dates, and summary polish — Phase 10 | 35 minutes |
| **Original Phases 1–10 target (historical)** | **7 hours 25 minutes** |
| Collaboration design — Phase 11 | 30–60 minutes |
| Clean schema, destructive reset, and database checks — Phase 12 | 1–2 hours |
| Group security, transactional APIs, and SQL tests — Phase 13 | 3–5 hours |
| Accounts, guest upgrade, and recovery — Phase 14 | 2–4 hours |
| Groups, invitations, and membership UI — Phase 15 | 2–4 hours |
| Group-scoped task features and state — Phase 16 | 3–5 hours |
| Realtime synchronization and access-loss recovery — Phase 17 | 1–3 hours |
| Integration, migration, security, and UI verification — Phase 18 | 3–6 hours |
| Documentation, deployment, and submission updates — Phase 19 | 1–2 hours |

The shared-group addition is a substantial change to authorization and data ownership, not a small account form. These ranges are planning allowances, not promises or measured time. Re-estimate after the database and guest-conversion checkpoints; the old 9-hour-25-minute full-update target no longer covers the expanded scope.

### Milestones

- [x] **Plan reviewed:** Existing behavior, scope, management views, and task detail design are agreed.
- [x] **Shared-group contract recorded:** Email/password plus unique usernames, guest preservation, group permissions, and invitation acceptance are defined in Phase 11.
- [ ] **Database ready:** Clean/reset group schema, membership constraints/policies, atomic group/invitation/task operations, and activity capture pass real-client checks.
- [ ] **Accounts ready:** Guests register without losing identity/work; login, recovery, usernames, and session changes work.
- [ ] **Groups ready:** Users create/join/switch groups, guests accept invitations, and membership/ownership changes enforce access correctly.
- [ ] **Workspace ready:** Shared types/state, navigation, and the task detail shell work.
- [ ] **Organization ready:** Real group members, multiple assignees, labels, and card metadata persist in their proper group.
- [ ] **Context ready:** Comments and activity are available in task details with reliable loading and recovery.
- [ ] **Board ready:** All filters, due-date indicators, and clearly scoped statistics work together.
- [ ] **Shared work ready:** Realtime updates, conflicts, reconnect, and access-loss handling pass two-client checks without mixing groups/accounts.
- [ ] **Release ready:** Regression/security/migration checks pass; deployment and documents match the implementation.

### Review at each checkpoint

- Summarize the files and user-visible behavior added in the completed phase.
- State which checks passed and any verification that still needs a real database or browser.
- Provide the shortest useful manual review steps for that phase.
- Stop for the user's review before implementing the next phase.

## 4. Official references

Check current documentation before implementation, especially migration CLI behavior, Data API exposure, function privileges, and relational query typing. These references support the planned database/access mechanisms; the product choices and phase order above are specific to Northstar.

- [Supabase changelog and breaking changes](https://supabase.com/changelog?types=breaking-change)
- [Supabase anonymous sign-in and guest identity](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase application profiles and Auth data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase email templates and confirmation](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase Auth state changes](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Supabase CLI v3 changes](https://supabase.com/changelog/supabase-cli-v3)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Explicit Data API grants and access control](https://supabase.com/docs/guides/api/securing-your-api)
- [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Supabase database functions and function security](https://supabase.com/docs/guides/database/functions)
- [Supabase Postgres triggers](https://supabase.com/docs/guides/database/postgres/triggers)
- [Supabase joins and nested queries](https://supabase.com/docs/guides/database/joins-and-nesting)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase TypeScript type generation](https://supabase.com/docs/guides/api/rest/generating-types)
- [PostgreSQL constraints and composite foreign keys](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL function privileges and security](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [React state structure](https://react.dev/learn/choosing-the-state-structure)
- [dnd kit React documentation](https://dndkit.com/react/quickstart/)
- [MDN History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API)
- [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Vite static deployment](https://vite.dev/guide/static-deploy.html)
