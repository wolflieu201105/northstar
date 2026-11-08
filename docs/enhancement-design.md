# Enhancement design and baseline

Phase 1 deliverable for [path-updates.md](../path-updates.md). This document records the implementation decisions for the new features. The sketches describe the intended interface; they are not completed application screens.

## Scope

Keep one private workspace per authenticated guest, the four existing task statuses, and the existing black–green visual system.

Team members are profiles managed by the guest: name, optional avatar color, generated initials, and active/archived state. A task can have multiple assignees and multiple labels. Creating or assigning a member does not create an authentication account or share the workspace.

Comments belong to a task and are authored by the authenticated guest. Activity describes committed database changes. Neither comments nor activity can impersonate a team member.

Existing tasks retain their IDs, owners, fields, and timestamps during the upgrade. They begin with no assignees or labels. History starts when capture is enabled; previous changes will not be reconstructed or invented.

## Baseline audit

| Area | Evidence in the current source | Verification boundary |
| --- | --- | --- |
| Guest session | `useGuestSession` restores a session or starts anonymous sign-in; initialization is shared across development rerenders. | Source reviewed. A fresh real guest/session-restoration check remains part of database integration verification. |
| Task CRUD | `services/tasks.ts` performs ownership-filtered Supabase requests; `useTasks` applies committed results. | Existing tests cover loading and local mutation state using a mocked task service. |
| Drag/drop | Board columns are drop targets; each card has a separate drag handle. Failed status saves restore the old status. | Rollback is covered by an existing hook test; pointer/keyboard/mobile dragging requires browser verification. |
| Schema | `tasks` has owner policies, explicit grants, validation, timestamps, and an ownership-first query index. | Local SQL reviewed. Hosted policies and grants have not been queried in this checkpoint. |
| Search/filtering | Case-insensitive title and description search combines with one priority filter. | Existing utility tests cover current behavior. |
| Urgency | `getDueState` compares local calendar dates, uses a three-day upcoming window, and excludes Done. | Existing utility tests cover the current classifications. |
| Summary | Total/completed/overdue are derived from all loaded tasks before filtering. | Existing utility test covers whole-board counts. |
| Visual system | Near-black primary controls, green accents, neutral/mint surfaces, red/amber urgency, shared CSS variables. | Existing tokens reviewed; their values remain the starting point for new components. |

The user previously reported that the connected application works. That report and the local automated checks are baseline evidence, not a replacement for the direct two-guest database tests planned in Phase 11.

### Local regression results

Results for the source at the start of Phase 1:

| Command | Result |
| --- | --- |
| `npm run lint` | Passed with no findings. |
| `npm test` | Passed: 12 tests in 3 files. Services are mocked in the hook tests. |
| `npm run build` | Passed, including TypeScript. Initial JavaScript chunk is approximately 459 kB uncompressed, with separate Board and TaskForm chunks. |

### Findings to carry into implementation

- A completed task with a saved due date currently shows “No due date” because the card treats the absence of urgency as the absence of a date. Phase 10 should keep the date and render it neutrally.
- Date-driven indicators/counts currently recalculate on state changes, without a midnight refresh. Phase 10 should update the local current date on midnight and visibility changes.
- The task dialog currently receives a task object snapshot. Phase 4 should resolve persisted data by selected task ID and keep unsaved edits as a separate draft.
- The existing mutation guard covers task moves in React state. Phase 4 must coordinate moves, detail edits, assignments, and tags through a shared per-task mutation guard.
- Summary counts currently render as zero during initial loading or a failed first load. Phase 10 should use a loading/unavailable presentation until a successful task response is available.

These findings are scheduled within the existing update phases. This checkpoint does not change their runtime behavior.

## Workspace layout

Use the existing app shell and add three navigation entries. Keep the board as the main working surface. Team and Labels are management views inside the same shell, with the same guest session and cached workspace data.

```text
Northstar     Board | Team | Labels        Guest        + New task
----------------------------------------------------------------
My workspace
Project flow             Whole board: 18 total / 5 done / 2 overdue

Team: [AL] [JM] [+3]                     Manage team

[Search tasks...] [Priority] [Assignee] [Label] [Clear filters]
Showing 4 of 18 tasks                  Active filters: Bug [x]

To Do            In Progress       In Review        Done
4 of 7           0 of 3             0 of 3          0 of 5
---------------  ----------------  --------------- --------------
High       [::]  No matching tasks  No matches      No matches
Fix sign-in
[Bug] [Feature]
Overdue Nov 7        [AL][JM]
---------------
+ Add task       + Add task        + Add task       + Add task
```

The sketch uses sample content only. Do not seed shared members, labels, or tasks into real guest workspaces as part of the visual implementation.

### Board behavior

- Card titles and the detail action open task details. The dedicated drag handle starts dragging, so opening and dragging remain separate interactions.
- Show at most three assignee avatars on a card, then an overflow count. Provide all names as accessible text; hover alone must not be required.
- Show at most two label chips on a card, then an overflow count. Full lists remain available in task details.
- Keep compact urgency text with an icon, and a neutral due date for completed tasks.
- Continue showing four columns when filters return no matches. Present one clear filtered-results message and retain per-column counts.
- Preserve the current horizontal column scrolling on mobile. Let the toolbar wrap into reachable controls rather than compressing labels into tiny targets.

## Team and Labels management

```text
Northstar     Board | Team | Labels        Guest        + New task
----------------------------------------------------------------
Team                                             + Add member
Profiles available to assign in your private workspace.
[Active] [Archived]

Avatar     Name              Assigned tasks       Actions
[AL]       Alex Lee          3                    Edit | Archive
[JM]       Jordan Mills      2                    Edit | Archive

Add/edit member: [Name_________________] [Color swatches]
                [Cancel] [Save member]
```

Use an inline editor within the management view for the short member form. Labels use the same pattern with label name, color preview, and task usage count. A compact list becomes stacked rows on narrow screens.

Archive retains the profile/label and its current task links. Existing links display an “Archived” marker; pickers exclude archived options from new selections. A task can remove an archived link. Restore makes the record selectable again. A label name that matches an archived record offers restore instead of creating a duplicate.

There is no destructive member/label delete action in this version. Task deletion remains a confirmed operation with child records removed by the database.

## Task details

On desktop, open a modal side panel approximately 560–640 px wide, within the viewport, over the board. On narrow screens it fills the available screen. Use one dialog with a single scrolling content area and a reachable close control.

```text
                                        Task details          [x]
                                        -------------------------
                                        [Task title_____________]
                                        [Description____________]
                                        [_______________________]
                                        Status       Priority
                                        [In progress] [High]
                                        Due date [2026-11-10]
                                        Assignees [AL][JM] [+ Add]
                                        Labels    [Bug] [Feature]
                                        [Delete]  [Cancel] [Save]
                                        -------------------------
                                        Comments | Activity

                                        Guest · Nov 8, 1:30 PM
                                        Confirmed the reproduction.

                                        [Write a comment________]
                                        [_______________________]
                                                   [Post comment]
```

Task-field saving and comment submission are separate actions with separate pending/error states and sibling forms. Saving metadata keeps an existing task's panel open so comments and activity remain usable. Creating a task commits all selected fields/relations before its detail/comments become available.

The Activity tab replaces the comment list/composer with persisted timeline entries and Load more. Both lists use oldest-first timestamp/ID order. Relative timestamps also expose an exact local date/time. Empty history on pre-upgrade tasks explains when history became available.

### Draft and navigation rules

- Maintain a local edit draft separately from the last saved task. Update the card only from committed results, except for the existing optimistic status move with rollback.
- Retain metadata and comment drafts across detail-tab switches and failed requests. Comments do not wait for unrelated metadata changes to be saved.
- If the task is changed elsewhere while the draft is dirty, report a conflict and retain the draft instead of silently replacing it.
- Confirm discard before a close, task switch, management navigation, or Back/Forward action would lose an unsaved draft. A native unload warning is a best-effort additional safeguard for refresh/closing the tab.
- Show a pending save clearly and block conflicting mutations on that task until it resolves. Closing a pending request must not discard its eventual committed result.
- On close, restore focus to the opener when it exists. For a direct URL without an opener, focus the board heading or another stable control.
- After task deletion, clear its selected ID and detail caches, then return to the previous board state.

## Navigation and filtering contract

The app can use the browser History API plus `URLSearchParams`; a routing package and path rewrites are not required for these query-based views.

| Parameter | Meaning |
| --- | --- |
| `view` | `team` or `labels`; omitted means board. Unknown values fall back to board. |
| `task` | Selected task UUID on the board. A nonexistent/inaccessible task gets a generic unavailable message. |
| `q` | Trimmed title/description search text. |
| `priority` | `low`, `normal`, or `high`; omitted means all. |
| `assignee` | Repeated member UUIDs, or the exclusive value `unassigned`; omitted means all. |
| `label` | Repeated label UUIDs, or the exclusive value `unlabeled`; omitted means all. |

Examples: `/?view=team`, `/?task=<uuid>&priority=high`, and `/?assignee=<uuid>&label=<uuid>`.

- Use history entries for deliberate view changes and opening task details. Replace the current entry for typing/filter refinements, so Back does not step through each keystroke.
- Opening task details from the board preserves filter parameters and board scroll position. Closing a directly opened task must safely return to the board rather than leave the site.
- Preserve filter parameters while visiting management views; show them again when returning to the board.
- Give `view` precedence over `task` if a URL contains both, and normalize the unsupported combination.
- Ignore malformed/unknown identifiers after guest-owned lookup data loads. Never use a URL ID as authorization.
- Assignee matches ANY selected member; label matches ANY selected label. Search, priority, assignee, and label groups combine with AND.
- Unassigned and Unlabeled are exclusive modes within their respective filter group. Clear filters resets all four groups and keeps the current workspace navigation coherent.
- Whole-board counts include every loaded task exactly once. Filtered result/column counts are labeled separately.

## Data and component boundaries

Preserve the existing `Task` database-row shape for scalar fields. In Phase 4 introduce a task view model with assignee and label summaries, plus a separate draft containing selected ID arrays. Comments and activity load only in task details.

| Layer | Contract to implement |
| --- | --- |
| Board/cards | Receive resolved task view models, pending-task IDs, and callbacks such as `onOpenTask(taskId)` and `onMove(taskId, status)`. |
| App/navigation | Own selected view, selected task ID, filter values, and opener/scroll restoration. |
| Task state | Own canonical persisted tasks and serialize writes for each task. Merge committed server responses and reconcile failed/ambiguous outcomes. |
| Workspace data | Own member/label lookups and task links; propagate rename/color/archive changes to presentation. |
| Detail panel | Resolve the selected task by ID, own drafts/tab state, and call typed mutations. It does not maintain a second canonical task list. |
| Detail data | Key comments/activity by guest and task; provide independent loading, errors, pagination, and stale-response cancellation/ignoring. |
| Task save service | Save scalar fields and both relationship sets atomically; return the persisted task view model. Omitted ID arrays mean unchanged; empty arrays mean clear. |
| Database | Enforce ownership and relationship integrity; capture activity in the mutation transaction. No client-authored authoritative history. |

These are design contracts, not additional runtime types or functions added in Phase 1. Exact Supabase function signatures and generated database types are finalized during Phases 2–4.

## Application states

| State | Intended presentation and recovery |
| --- | --- |
| Workspace starting/loading | Preserve the existing auth/loading screens. Show skeletons/placeholders rather than definitive zero statistics. |
| No members or labels | Explain the purpose and offer the first create action. Task creation still permits no selections. |
| No task matches | Keep filters and columns available; explain that saved tasks are hidden and offer Clear filters. |
| Detail list loading/error | Keep task fields usable; show loading or Retry only in the affected Comments/Activity tab. |
| Comment or metadata save failed | Show an inline error and keep the draft. Clear it only after confirmed success. |
| Stale task edit | Explain that the saved task changed, retain the local draft, and offer reload/review before another save. |
| Task missing/inaccessible | Generic unavailable state with Return to board. Do not reveal another owner's title or metadata. |
| Archived item still linked | Render its existing name/color plus Archived; permit removal, with restoration handled in management. |

## Checkpoint review

Phase 1 establishes the reviewed baseline and implementation blueprint. Database SQL begins in Phase 2; policies/transactional history are completed and verified in Phase 3 before UI integration.

Review the workspace sketch, management views, detail panel, and filter rules in this document. The remaining live verification is explicit in the baseline table and will be recorded when a real browser/database integration checkpoint is executed.
