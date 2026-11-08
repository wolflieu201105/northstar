# Task Manager Enhancements — Step-by-Step Build Plan

Extend the existing Northstar task board with team members, multiple assignees, comments, activity history, and custom labels. Complete the existing due-date, filtering, and summary features as part of the same update. This document is a work plan: check items off as they are implemented and verified. It does not describe already completed enhancements.

Keep [path.md](path.md) as the original build plan and [README.md](README.md) as the description of the working application. This update plan follows the same roadmap, checklist, acceptance criteria, time-budget, and reference structure.

## 1. High-level roadmap

Follow this order. Finish each phase's **Done when** check before moving on. Stop after each numbered phase so the result can be reviewed before the next checkpoint. The seven requested feature groups are in scope; do not silently drop one to meet a time estimate.

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
| 11 | Verify security and the complete experience | Test migration safety, isolation, failures, responsiveness, and regressions. |
| 12 | Update documentation and release | Document the upgrade, deploy the tested version, and update submission materials. |

**Stack:** Keep React + TypeScript + Vite, Supabase JS, dnd kit React, plain CSS, Vitest, Testing Library, and the current CI workflow. Reuse the existing client and guest authentication. No separate backend or avatar upload service is required for this update.

**Scope:** One private workspace per guest. A team member is a guest-managed profile with a name and optional avatar color, not a separate authenticated collaborator. Multiple profiles can be assigned to one task. Comments are written by the current guest; assigning a profile does not give that person access or make them the comment author. Shared accounts, invitations, email notifications, and account recovery remain future work.

### Current baseline

The following items exist in the source and should be retained and regression-tested rather than rebuilt.

| Requested feature | Current implementation | Work still needed |
| --- | --- | --- |
| Team members and assignees | Not implemented. | Member records, management view, multi-assignment, board avatars. |
| Task comments | Not implemented. | Separate table, service, composer, chronological detail list. |
| Task activity log | Not implemented. | Database events, append-only access rules, timeline. |
| Labels / tags | Not implemented. | Label records, management view, task links, filters. |
| Due-date indicators | `getDueState`, card indicators, and Done exclusion exist. | Verify boundaries, refresh at local midnight, and retain dates for completed tasks. |
| Search and filtering | Case-insensitive title/description search and priority filtering exist. | Add assignee and label filters and define how all filters combine. |
| Board summary / stats | Total, completed, and overdue counts exist. | Explicit whole-board labeling and reliable updates after all new mutations. |

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

Owner: Codex | Status: Complete — ready for review | Next action: Review the SQL, then begin Phase 3 access policies and transactional activity capture.

Deliverables: [clean-install schema](supabase/schema.sql), [CLI-generated additive migration](supabase/migrations/20261108193633_add_workspace_enhancements.sql), [read-only preflight](supabase/preflight.sql), and [upgrade/test guide](docs/database-upgrade.md). The hosted project was inspected read-only. PostgreSQL 17.5 passed 45 assertions for each of the clean-install and upgrade paths; catalog parity and repeat application were verified. New tables have RLS enabled with API privileges closed until Phase 3. Hosted application, Supabase advisors, and real guest-client checks remain pending.

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

Owner: ___ | Status: Not started | Next action: Add policies, grants, transactional functions, and activity triggers.

#### 3.1 Add explicit Data API grants and RLS

- [ ] Enable RLS on all six new tables.
- [ ] Keep unauthenticated `anon` clients without table or mutation-function access.
- [ ] Give `authenticated` guests only the table/column privileges required by supported operations.
- [ ] Use `(select auth.uid()) = user_id` for row ownership and retain SELECT policies for rows that can be updated.
- [ ] Use both `USING` and `WITH CHECK` on UPDATE policies.
- [ ] Require task ownership on child records and reject ownership changes through column privileges and policies.
- [ ] Test access through the Data API; table grants and RLS must both work.

| Table | Permitted guest operations |
| --- | --- |
| `team_members`, `labels` | Read own records; create and edit allowed fields; archive/restore through allowed updates. |
| `task_assignees`, `task_labels` | Read own links, insert permitted links, and delete own links. Keys cannot be updated in place. |
| `comments` | Read own task comments and insert comments on own tasks. Editing/deleting comments is deferred. |
| `task_activity` | Read history for own tasks only. No direct INSERT, UPDATE, or DELETE privileges. |

#### 3.2 Save task changes atomically

- [ ] Add a typed Supabase RPC for creating/updating a task and its assignment/label sets in one database transaction.
- [ ] Use `SECURITY INVOKER` for this application function so ordinary grants and RLS remain active.
- [ ] Resolve the owner from `auth.uid()` and reject unauthenticated requests; never trust a supplied owner or actor ID.
- [ ] Lock the task row during an update, validate all incoming IDs, and apply only actual relationship differences.
- [ ] Treat an omitted relationship array as unchanged and an empty array as remove all; reject or normalize duplicate IDs.
- [ ] Return the saved task and complete assignment/label data after commit.
- [ ] Reject the entire save if any field, member, label, relationship, or event write fails.
- [ ] Use the server-returned `updated_at` as an expected-change token for edits; reject stale edits and retain the local draft for reconciliation.
- [ ] Ensure assignment/tag-only updates also touch the parent timestamp without generating a fictitious field-edit event.
- [ ] Route create/edit/assignment/tag saves through this RPC. Keep status-only drag saves compatible with the same locking and activity rules.
- [ ] Keep member/label archive and assignment operations consistent under concurrent requests.

#### 3.3 Capture history at the database layer

- [ ] Define event types for creation, status changes, field edits, assignee additions/removals, and label additions/removals.
- [ ] Add task and join-table triggers so writes through either the UI or a permitted direct client produce corresponding activity.
- [ ] Write activity in the same transaction as its source mutation; a failed save must leave neither partial data nor a success event.
- [ ] Keep the activity table read-only to guests. An ordinary invoker trigger cannot append into a table that rejects guest inserts.
- [ ] For this narrow append operation, use a reviewed `SECURITY DEFINER` trigger function in a non-exposed `private` schema, with an empty `search_path` and fully qualified references.
- [ ] Restrict the function to the intended trigger tables/events, validate the authenticated owner against the source row, and derive actor, payload, and timestamps from trusted database context.
- [ ] Revoke direct function execution from public API roles; do not expose a client-callable “insert activity” endpoint or accept arbitrary event payloads from the UI.
- [ ] Define cascade cleanup behavior explicitly: task/auth-user deletion must not fail because a child trigger tries to append history to a disappearing task.
- [ ] Record only meaningful differences; no-op saves and timestamp-only updates must not duplicate events.
- [ ] Snapshot member/label names and old/new values in event payloads so later renaming or archival does not rewrite history.
- [ ] Run Supabase security/performance advisors and review privileged functions before accepting this checkpoint.

**Done when:** Guest clients can perform their allowed operations, cross-owner references are rejected, task saves are atomic, and history cannot be forged, edited, or deleted directly by guests.

### Phase 4 — Extend types, services, and state

Owner: ___ | Status: Not started | Next action: Define the new service contracts and mutation state.

#### 4.1 Extend the current project structure

Create files when needed, keeping the existing component/service/hook separation.

| Location | Responsibility |
| --- | --- |
| `src/types/database.ts` | Generated Supabase types after the migration is applied to a test database. |
| `src/types/team.ts`, `src/types/label.ts` | Member and label domain/draft types. |
| `src/types/comment.ts`, `src/types/activity.ts` | Comment rows and discriminated activity event payloads. |
| `src/types/task.ts` | Separate persisted task fields from a task view model with assignees and labels. |
| `src/services/team.ts`, `src/services/labels.ts` | Guest-owned member and label queries/mutations. |
| `src/services/tasks.ts` | Existing reads/status operations plus transactional task saves. |
| `src/services/comments.ts`, `src/services/activity.ts` | Task-specific comment and timeline reads; comment creation. |
| `src/hooks/useWorkspaceData.ts` | Members/labels and board relationship state. |
| `src/hooks/useTasks.ts` | Existing task operations extended for the saved task view model. |
| `src/hooks/useTaskDetails.ts` | Detail-only comment/activity loading, pagination, and recovery. |
| `src/hooks/useWorkspaceNavigation.ts` | Query-string view/task navigation and Back/Forward handling. |
| `src/components/TaskDetailPanel.tsx` | Task metadata, comment/activity tabs, save and close behavior. |
| `src/components/AssigneePicker.tsx`, `LabelPicker.tsx`, `MemberAvatar.tsx` | Reusable multi-selection and card/header presentation. |
| `src/components/CommentList.tsx`, `CommentComposer.tsx`, `ActivityTimeline.tsx` | Detail-view discussion and history. |
| `src/pages/TeamPage.tsx`, `src/pages/LabelsPage.tsx` | Management views within the existing app shell. |
| `supabase/schema.sql`, `supabase/migrations/` | Clean-install SQL and generated additive upgrade migration. |
| `supabase/tests/` | Ownership, relationship, activity, and migration integration tests. |

#### 4.2 Load and mutate data consistently

- [ ] Load tasks, members, labels, and task relationships after guest auth; parallelize independent requests.
- [ ] Use nested relational queries or bounded batch queries; avoid one assignee/label request per task card.
- [ ] Fetch comments and activity only for the opened task, with independent loading/error states.
- [ ] Key detail data by guest ID and task ID; ignore responses from a closed panel or previously selected task.
- [ ] Keep a single canonical board task state. The detail view should resolve its selected task by ID rather than retain a stale task snapshot.
- [ ] Preserve form/comment drafts on failure and guard duplicate submissions.
- [ ] Serialize or block overlapping mutations on the same task, including a drag while a detail save is pending.
- [ ] Update board, detail, lookup records, filters, and summary state from committed server results.
- [ ] Do not synthesize authoritative activity in the browser; invalidate/refetch the affected timeline after successful changes.
- [ ] For ambiguous network outcomes, reconcile with the server before retrying creation or appending comments; use stable request IDs where needed to avoid duplicates.

**Done when:** Typed services and state can load and save the full task model, handle rollback/conflicts, and keep the board and selected task synchronized.

### Phase 5 — Add workspace navigation and task details

Owner: ___ | Status: Not started | Next action: Build the shared navigation and responsive detail shell.

#### 5.1 Add management views

- [ ] Add Board, Team, and Labels navigation inside the existing app shell.
- [ ] Parse supported query parameters, handle unknown views gracefully, and subscribe to browser navigation.
- [ ] Keep the guest session and loaded workspace data alive between management views.
- [ ] Restore active board filters after returning from Team or Labels.
- [ ] Use the existing black–green tokens for navigation, panels, buttons, and focus states.

#### 5.2 Build the detail panel

- [ ] Open task details through a card title/action without interfering with the separate drag handle.
- [ ] Show title, description, status, priority, due date, assignee picker, label picker, and delete action.
- [ ] Reuse existing task form fields and validation, while avoiding nested forms or nested modal dialogs.
- [ ] Provide Comments and Activity tabs with clear loading, empty, and error states.
- [ ] Support direct task links and an inaccessible/deleted-task message without revealing another guest's data.
- [ ] Trap focus where appropriate, support Escape and an accessible close control, and return focus to the opener when available.
- [ ] Preserve unsaved drafts and confirm intentional discard on close/navigation.
- [ ] Close the panel after successful task deletion and remove related client state.
- [ ] Lazy-load detail/management surfaces and keep mobile controls and scrolling usable.

**Done when:** Navigation and the detail panel work with refresh, Back/Forward, keyboard input, and narrow screens, with no regression to task creation or drag/drop.

### Phase 6 — Build team members and multiple assignees

Owner: ___ | Status: Not started | Next action: Connect member management and the assignee picker.

#### 6.1 Manage the guest's team

- [ ] Build member creation with a visible name label and optional palette color selection.
- [ ] Reject blank or oversized names in both UI and database.
- [ ] Show member initials, name, color, active/archived status, and edit/archive/restore controls.
- [ ] Display active member avatars in the board header, with overflow such as `+3` and a Manage team entry point.
- [ ] Show a useful empty-team state and preserve entered values after a failed save.
- [ ] Make clear that these are workspace profiles, not invitations or newly authenticated accounts.

#### 6.2 Assign several members to tasks

- [ ] Use a checkbox-based multi-select with a search field when the list is long.
- [ ] Allow zero, one, or multiple assignees on creation and edit; zero means Unassigned.
- [ ] Save assignment changes through the atomic task mutation from Phase 3.
- [ ] Display a small avatar stack on cards; expose full assignee names through accessible text and an overflow indicator.
- [ ] Keep archived assignees visible with an archived marker until removed; prevent adding archived members.
- [ ] Propagate member renames/colors to cards and pickers without changing historical event snapshots.
- [ ] Verify assignment additions/removals produce the expected activity and survive refresh.

**Done when:** A guest can manage members and persist several assignees per task, with consistent avatars on the board and accurate assignment history.

### Phase 7 — Build custom labels and task tagging

Owner: ___ | Status: Not started | Next action: Connect label management and the label picker.

#### 7.1 Manage custom labels

- [ ] Add label creation, rename, color, archive, and restore controls in the Labels view.
- [ ] Use examples such as Bug, Feature, and Design as placeholders, not shared global records.
- [ ] Report case-insensitive duplicate names with an actionable message.
- [ ] Offer restore for a matching archived label rather than creating an ambiguous duplicate.
- [ ] Render text safely and keep label text readable against its palette background.

#### 7.2 Attach multiple labels

- [ ] Add a multi-select picker to creation and task details.
- [ ] Allow zero or multiple labels and save relationship changes atomically with other task edits.
- [ ] Render label chips on cards with a compact overflow treatment for long lists.
- [ ] Update label names/colors wherever they appear after an edit.
- [ ] Preserve archived labels already on tasks, allow removal, and reject new archived-label links.
- [ ] Verify label additions/removals are recorded in activity and persist after refresh.

**Done when:** Labels can be managed and attached to tasks, their card chips remain consistent, and relationships remain private to the guest.

### Phase 8 — Add persistent task comments

Owner: ___ | Status: Not started | Next action: Connect the composer and paginated comment list.

#### 8.1 Read comments

- [ ] Query the separate `comments` table using the selected task and guest identity.
- [ ] Display comments oldest first using `created_at` plus ID as a stable tie-breaker.
- [ ] Show the guest author, plain-text body, and a localized timestamp using `<time datetime="...">`.
- [ ] Include an exact local date/time when using a relative-time display.
- [ ] Keep initial loading, no-comments, read-error, and Load more states distinct.
- [ ] Use a stable cursor and batch size, such as 50 comments, so long discussions do not block opening a task.

#### 8.2 Write comments

- [ ] Reject whitespace-only comments and enforce the 2,000-character limit in both layers.
- [ ] Disable duplicate submissions while a comment is saving; leave the draft intact on failure.
- [ ] Append the saved server row and clear the draft only after a confirmed successful insert.
- [ ] Reconcile uncertain network outcomes before retrying so the same comment is not posted twice.
- [ ] Show an inline failure and Retry action without closing the detail panel.
- [ ] Preserve line breaks and render content as plain text, with no raw HTML injection.
- [ ] Do not allow choosing an assignee profile as the authenticated comment author.
- [ ] Keep comments attached to their task; deleting the task removes them through the database relationship.

**Done when:** Comments persist in their own table, appear chronologically with timestamps, and handle validation, failures, task switching, and pagination correctly.

### Phase 9 — Display the task activity timeline

Owner: ___ | Status: Not started | Next action: Render the persisted events created by Phase 3.

#### 9.1 Define readable event rendering

| Event type | Example display |
| --- | --- |
| `task_created` | Created this task · 2 hours ago |
| `status_changed` | Moved from To Do → In Progress · 2 hours ago |
| `task_edited` | Updated title and due date · 1 hour ago |
| `assignee_added` / `assignee_removed` | Assigned Alex / Removed Alex · 40 minutes ago |
| `label_added` / `label_removed` | Added Bug / Removed Design · 15 minutes ago |

- [ ] Render event payloads through typed formatter functions, not stored HTML.
- [ ] Use stored old/new values and member/label name snapshots for historical text.
- [ ] Do not call a guest-managed member the actor; display the authenticated guest as the actor.
- [ ] Provide a safe fallback for an unknown event type or older payload version.

#### 9.2 Build timeline behavior

- [ ] Show Activity oldest first with stable timestamp/ID ordering and Load more pagination.
- [ ] Display relative time plus an accessible exact local timestamp.
- [ ] Refresh relative labels while the panel is open and clean up timers on close.
- [ ] Refetch affected history after field edits, drag status changes, assignment changes, and label changes.
- [ ] Show an explicit baseline message for tasks that existed before history capture was enabled.
- [ ] Confirm a no-op save produces no event, while a failed or rolled-back mutation produces no success event.
- [ ] Verify parent-task deletion and auth-user cleanup succeed without orphaned history or trigger errors.

**Done when:** The timeline reflects committed database changes accurately, survives refresh, and cannot be rewritten through guest access.

### Phase 10 — Complete filters, due dates, and summaries

Owner: ___ | Status: Not started | Next action: Extend existing utilities and toolbar controls.

#### 10.1 Combine search and filters

- [ ] Retain the existing search bar: title matches are required, and the existing description-search behavior may remain.
- [ ] Keep case-insensitive, trimmed search and the current priority filter.
- [ ] Add an assignee filter with All, Unassigned, and selected member IDs.
- [ ] Add a label filter with All, Unlabeled, and selected label IDs.
- [ ] Match ANY selected member within the assignee filter and ANY selected label within the label filter.
- [ ] Combine search, priority, assignee, and label groups using AND.
- [ ] Keep archived records available as filter options if they are still attached to tasks; visibly mark them archived.
- [ ] Add active-filter chips and one Clear filters action that resets every group.
- [ ] Derive visible tasks from canonical data; filtering must not remove hidden tasks or their relationships.
- [ ] Keep column counts explicit, such as `2 of 6`, and distinguish no matches from an empty workspace.
- [ ] Preserve filters through task details and management navigation using supported query parameters.
- [ ] Ignore unknown/deleted filter IDs gracefully and keep the controls usable on mobile.

#### 10.2 Finish due-date behavior

| Condition | Indicator | Included in overdue count? |
| --- | --- | --- |
| Incomplete task due before the local current date | Red badge/icon and Overdue text. | Yes |
| Incomplete task due today | Amber badge/icon and Due today text. | No |
| Incomplete task due in the next 1–3 calendar days | Green-accent badge/icon and Due soon text. | No |
| Later due date | Neutral date. | No |
| Completed task | Neutral saved due date, with no urgency warning. | No |
| No due date | No due date state. | No |

- [ ] Reuse the existing `getDueState` and `formatDueDate` utilities; do not parse a date-only string as UTC midnight.
- [ ] Verify calendar-date comparisons across month/year boundaries and daylight-saving changes.
- [ ] Update urgency at local midnight and when the page becomes visible after being backgrounded; clear timers/listeners on unmount.
- [ ] Keep urgency text/icons alongside color and expose an understandable accessible label.
- [ ] Update urgency immediately after due-date or status changes.

#### 10.3 Clarify summary scope

- [ ] Keep Total, Completed, and Overdue as whole-board counts and visibly label that scope.
- [ ] Show filtered results separately, such as `Showing 4 of 18 tasks`.
- [ ] Derive counts from unique tasks, not joined query rows; multiple labels or assignees must not inflate totals.
- [ ] Update counts after task creation/deletion, status changes, due-date edits, and local-date changes.
- [ ] Do not treat failed task loading as a successfully empty board with authoritative zero counts.

**Done when:** Combined filters return predictable results, urgency remains correct as time changes, and summary counts are accurate and clearly scoped.

### Phase 11 — Verify security and the complete experience

Owner: ___ | Status: Not started | Next action: Add focused tests and exercise two isolated guest clients.

#### 11.1 Test application behavior

- [ ] Extend unit tests for combined filter semantics, Unassigned/Unlabeled, archived records, and duplicate joined rows.
- [ ] Test calendar urgency, midnight refresh, completed-task dates, and whole-board statistics.
- [ ] Test member/label validation, multi-pickers, keyboard interaction, and accessible avatar labels.
- [ ] Test detail navigation, tab loading, task switching, stale responses, and unsaved-draft handling.
- [ ] Test comments for blank rejection, order, timestamps, draft retention, and duplicate-request recovery.
- [ ] Test activity formatting, old/new values, historic names, unknown events, and no-op behavior.
- [ ] Test atomic save failures, stale edit conflicts, move rollback, and overlapping task mutations.
- [ ] Retain regression coverage for guest auth, task CRUD, four columns, empty drop targets, and refresh persistence.
- [ ] Test desktop and narrow mobile flows, including multiple assignments, tags, comments, and filters.
- [ ] Run lint, tests, type checks/production build, and a dependency audit appropriate to changed packages.

#### 11.2 Verify ownership with real guest clients

Use Guest A and Guest B access tokens against the actual Data API/RPC in an isolated test project. Interface filtering and SQL Editor queries do not prove RLS isolation.

- [ ] Have both guests create tasks, members, labels, assignments, and comments.
- [ ] Through B, try reading, updating, archiving, or deleting known A records; confirm A data remains inaccessible and unchanged.
- [ ] Try linking B's task to A's member/label and A's task to B's member/label; confirm both directions fail.
- [ ] Try creating a comment or history-related relationship on A's task through B; confirm rejection.
- [ ] Try inserting with A's `user_id`, changing ownership, and rewriting protected timestamps through B.
- [ ] Try assigning archived members and attaching archived labels through a direct client; confirm rejection.
- [ ] Try direct INSERT, UPDATE, DELETE, and RPC-based forgery of activity; confirm no guest can author arbitrary history.
- [ ] Verify allowed mutations still append correct events and failed transactions append none.
- [ ] Verify anonymous clients without a signed-in guest token cannot access the new tables/functions.
- [ ] Check unauthorized zero-row updates/deletes as well as explicit errors, then re-read data as its real owner.
- [ ] Run advisors and resolve findings or document a specific reviewed exception.

#### 11.3 Verify upgrade and recovery

- [ ] Upgrade a copy of the current schema containing existing tasks, then compare all preexisting values.
- [ ] Apply the full schema to an empty test project and run the same guest-client checks.
- [ ] Confirm generated types and application queries match both installation paths.
- [ ] Exercise auth-user/task cascades and verify no orphaned links, comments, or activity remain.
- [ ] Confirm the previous frontend can still use the upgraded database, or document a coordinated release order before deployment.
- [ ] Record tested commit, migration version, environment, and results without storing guest tokens.

**Done when:** All seven requested features work through refresh and failures, database isolation is verified directly, and both upgrade and clean-install paths pass.

### Phase 12 — Update documentation and release

Owner: ___ | Status: Not started | Next action: Document verified features and prepare the reviewed release.

#### 12.1 Update the project handoff

- [ ] Update README features, navigation, domain model, setup, and known limitations to match the verified build.
- [ ] Document member/label archival, multiple assignments, comment rules, filter semantics, history retention, and summary scope.
- [ ] Explain that members are guest-managed profiles and do not create shared authenticated access.
- [ ] Include upgrade instructions for existing users and full-schema instructions for new installations.
- [ ] Document application RPCs, RLS/relationship constraints, and the narrowly scoped activity trigger privileges.
- [ ] Add the exact repository/live URLs and current screenshots once available.
- [ ] Verify setup instructions against a clean checkout and keep `.env.local` ignored.

#### 12.2 Deploy the tested update

- [ ] Confirm the intended GitHub repository, hosting project, Supabase project, and tested commit.
- [ ] Apply the reviewed additive database upgrade first, with compatibility and recovery checks from Phase 11.
- [ ] Deploy the frontend using the existing Vite build settings and public Supabase environment values.
- [ ] Verify Board, Team, Labels, and direct task links on the deployed URL, including refresh and Back/Forward.
- [ ] Repeat create → assign → tag → comment → move → inspect history → refresh on the live app.
- [ ] Repeat cross-guest isolation checks and inspect application/database errors before accepting the release.
- [ ] Keep backup/recovery instructions available; do not use a destructive schema rollback as a routine frontend rollback.

#### 12.3 Update assessment materials

- [ ] Include all implemented enhancements and the reasons for the database/UI design choices.
- [ ] Include the full final SQL: every table, constraint, index, grant, policy, function, and trigger.
- [ ] Include clickable live-app and GitHub links, local setup, migration instructions, and verification results.
- [ ] Explain remaining limits, such as guest account recovery, real shared collaboration, image uploads, and cross-tab realtime sync.
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
| Integration, migration, security, and UI verification — Phase 11 | 80 minutes |
| Documentation, deployment, and submission updates — Phase 12 | 40 minutes |
| **Enhancement planning target** | **9 hours 25 minutes** |

### Milestones

- [x] **Plan reviewed:** Existing behavior, scope, management views, and task detail design are agreed.
- [ ] **Database ready:** Additive schema, ownership constraints, policies, atomic saves, and activity capture pass guest-client checks.
- [ ] **Workspace ready:** Shared types/state, navigation, and the task detail shell work.
- [ ] **Organization ready:** Members, multiple assignees, labels, and card metadata persist.
- [ ] **Context ready:** Comments and activity are available in task details with reliable loading and recovery.
- [ ] **Board ready:** All filters, due-date indicators, and clearly scoped statistics work together.
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
